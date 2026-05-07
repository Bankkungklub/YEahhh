import { WebSocketServer } from "ws";
import { getPublicDroneConfig } from "../../shared/config/droneConfig.js";
import { getPublicEventObjectiveConfig } from "../../shared/config/eventObjectiveConfig.js";
import { GAME_CONFIG, getPublicConfig } from "../../shared/config/gameConfig.js";
import { getPublicTankClassConfig } from "../../shared/config/tankClassConfig.js";
import { CLIENT_MESSAGES, parseClientMessage, SERVER_MESSAGES } from "../../shared/protocol/messages.js";
import { isOriginAllowed } from "./runtimeConfig.js";

export class NetworkHub {
  constructor({ httpServer, roomManager, authService, config = GAME_CONFIG, runtime = null, now = () => Date.now() }) {
    this.roomManager = roomManager;
    this.authService = authService;
    this.config = config;
    this.runtime = runtime;
    this.now = now;
    this.clientSerial = 1;
    this.clients = new Map();
    this.wss = new WebSocketServer({
      server: httpServer,
      maxPayload: config.network.maxMessageBytes,
      verifyClient: (info, done) => this.verifyClient(info, done)
    });
    this.heartbeatTimer = null;

    this.wss.on("connection", (ws, request) => this.handleConnection(ws, request));
    this.startHeartbeat();
  }

  verifyClient(info, done) {
    if (!this.validateSocketOrigin(info.req)) {
      done(false, 403, "WebSocket origin is not allowed.");
      return;
    }
    const maxClients = this.runtime?.websocket?.maxClients ?? Infinity;
    if (this.clients.size >= maxClients) {
      done(false, 503, "Server is full.");
      return;
    }
    done(true);
  }

  validateSocketOrigin(request) {
    return isOriginAllowed(request?.headers?.origin ?? "", this.runtime);
  }

  handleConnection(ws, request) {
    const account = this.authService?.getAccountFromRequest(request) ?? null;
    const nowMs = this.now();
    const client = {
      id: `client-${this.clientSerial}`,
      ws,
      account,
      playerId: null,
      roomId: null,
      room: null,
      joined: false,
      lastInputAtMs: 0,
      connectedAtMs: nowMs,
      lastPongAtMs: nowMs,
      messageWindowStartMs: nowMs,
      messageCountInWindow: 0
    };
    this.clientSerial += 1;
    this.clients.set(client.id, client);

    ws.on("message", (data) => this.handleRawMessage(client, data.toString("utf8")));
    ws.on("pong", () => {
      client.lastPongAtMs = this.now();
    });
    ws.on("close", () => this.disconnectClient(client));
    ws.on("error", () => this.disconnectClient(client));
  }

  handleRawMessage(client, raw) {
    if (!this.checkMessageRate(client)) {
      return;
    }
    const parsed = parseClientMessage(raw, this.config);
    if (!parsed.ok) {
      this.send(client, { type: SERVER_MESSAGES.ERROR, message: parsed.error });
      return;
    }

    const message = parsed.message;
    switch (message.type) {
      case CLIENT_MESSAGES.JOIN:
        this.handleJoin(client, message);
        break;
      case CLIENT_MESSAGES.INPUT:
        if (client.playerId && client.room) {
          client.room.game.receiveInput(client.playerId, message);
        }
        break;
      case CLIENT_MESSAGES.UPGRADE:
        if (client.playerId && client.room) {
          client.room.game.applyUpgrade(client.playerId, message.key);
        }
        break;
      case CLIENT_MESSAGES.SELECT_CLASS:
        if (client.playerId && client.room && !client.room.game.selectTankClass(client.playerId, message.classId)) {
          this.send(client, { type: SERVER_MESSAGES.ERROR, message: "Class is not available yet." });
        }
        break;
      case CLIENT_MESSAGES.RESPAWN:
        if (client.playerId && client.room) {
          client.room.game.requestRespawn(client.playerId);
        }
        break;
      case CLIENT_MESSAGES.PING:
        this.send(client, {
          type: SERVER_MESSAGES.PONG,
          t: message.t,
          serverTimeMs: Math.round(client.room?.game.timeMs ?? 0)
        });
        break;
    }
  }

  handleJoin(client, message) {
    if (client.joined) {
      return;
    }

    const room = message.roomId
      ? this.roomManager.getRoom(message.roomId)
      : this.roomManager.chooseQuickplayRoom();

    if (!room) {
      this.send(client, { type: SERVER_MESSAGES.ERROR, message: "Room not found." });
      return;
    }

    if (room.isFull()) {
      this.send(client, { type: SERVER_MESSAGES.ERROR, message: "Room is full." });
      return;
    }

    const tank = room.game.createHumanPlayer(client.id, message.name, {
      account: client.account
    });
    client.playerId = tank.id;
    client.roomId = room.id;
    client.room = room;
    client.joined = true;
    room.addClient(client);
    this.send(client, {
      type: SERVER_MESSAGES.WELCOME,
      playerId: tank.id,
      room: room.getSummary(),
      account: client.account,
      config: getPublicConfig(this.config, {
        tankClasses: getPublicTankClassConfig(),
        eventObjectives: getPublicEventObjectiveConfig(),
        drones: getPublicDroneConfig()
      })
    });
  }

  disconnectClient(client) {
    if (!this.clients.has(client.id)) {
      return;
    }
    this.clients.delete(client.id);
    if (client.room) {
      client.room.game.markDisconnected(client.id);
      client.room.removeClient(client.id);
    }
  }

  checkMessageRate(client) {
    const limit = this.runtime?.websocket?.messageRateLimit ?? Infinity;
    if (!Number.isFinite(limit)) {
      return true;
    }
    const nowMs = this.now();
    if (nowMs - client.messageWindowStartMs >= 1000) {
      client.messageWindowStartMs = nowMs;
      client.messageCountInWindow = 0;
    }
    client.messageCountInWindow += 1;
    if (client.messageCountInWindow <= limit) {
      return true;
    }
    this.closeClient(client, 1008, "Message rate limit exceeded.");
    return false;
  }

  startHeartbeat() {
    const heartbeatMs = this.runtime?.websocket?.heartbeatMs ?? 0;
    if (!Number.isFinite(heartbeatMs) || heartbeatMs <= 0) {
      return;
    }
    this.heartbeatTimer = setInterval(() => this.checkHeartbeat(), heartbeatMs);
    this.heartbeatTimer.unref?.();
  }

  checkHeartbeat() {
    const nowMs = this.now();
    const heartbeatMs = this.runtime?.websocket?.heartbeatMs ?? 0;
    const timeoutMs = this.runtime?.websocket?.heartbeatTimeoutMs ?? 0;
    const maxAgeMs = heartbeatMs + timeoutMs;
    for (const client of this.clients.values()) {
      if (nowMs - client.lastPongAtMs > maxAgeMs) {
        this.closeClient(client, 4000, "Heartbeat timeout.");
        continue;
      }
      try {
        client.ws.ping();
      } catch {
        this.closeClient(client, 4000, "Heartbeat failed.");
      }
    }
  }

  closeClient(client, code = 1001, reason = "Server closing.") {
    try {
      client.ws.close(code, reason);
    } catch {
      this.disconnectClient(client);
    }
  }

  closeAllClients(code = 1001, reason = "Server shutting down.") {
    for (const client of [...this.clients.values()]) {
      this.closeClient(client, code, reason);
    }
  }

  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.closeAllClients(1001, "Server shutting down.");
    this.wss.close();
  }

  getDebugState() {
    return {
      clients: this.clients.size,
      maxClients: this.runtime?.websocket?.maxClients ?? null
    };
  }

  broadcastSnapshots() {
    for (const room of this.roomManager.rooms.values()) {
      const snapshot = room.game.createSnapshot();
      const roomSummary = room.getSummary();
      for (const client of room.clients.values()) {
        if (!client.joined || !client.playerId) {
          continue;
        }
        this.send(client, {
          type: SERVER_MESSAGES.SNAPSHOT,
          you: client.playerId,
          room: roomSummary,
          ...snapshot
        });
      }
    }
  }

  flushEvents() {
    for (const room of this.roomManager.rooms.values()) {
      for (const event of room.game.consumeEvents()) {
        const client = this.clients.get(event.clientId);
        if (!client) {
          continue;
        }
        if (event.type === "damage") {
          this.send(client, {
            type: SERVER_MESSAGES.DAMAGE,
            amount: event.amount,
            cause: event.cause,
            causeLabel: event.causeLabel,
            color: event.color,
            sourceId: event.sourceId,
            sourceName: event.sourceName,
            sourceKind: event.sourceKind,
            sourceX: event.sourceX,
            sourceY: event.sourceY,
            targetX: event.targetX,
            targetY: event.targetY,
            timeMs: event.timeMs
          });
          continue;
        }
        if (event.type !== "death") {
          continue;
        }
        this.send(client, {
          type: SERVER_MESSAGES.DEATH,
          killerName: event.killerName,
          deathCause: event.deathCause,
          score: event.score,
          level: event.level,
          oldLevel: event.oldLevel,
          newLevel: event.newLevel,
          oldClassId: event.oldClassId,
          newClassId: event.newClassId,
          scoreLost: event.scoreLost,
          deathPenalty: event.deathPenalty,
          respawnAtMs: event.respawnAtMs
        });
      }
    }
  }

  send(client, message) {
    if (client.ws.readyState !== client.ws.OPEN) {
      return;
    }
    client.ws.send(JSON.stringify(message));
  }
}
