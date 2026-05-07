import { randomBytes } from "node:crypto";
import { APP_CONFIG } from "../../shared/config/appConfig.js";
import { GAME_CONFIG } from "../../shared/config/gameConfig.js";
import { RoomSession } from "./roomSession.js";

export class RoomManager {
  constructor({
    config = GAME_CONFIG,
    appConfig = APP_CONFIG,
    accountStore = null,
    now = () => Date.now()
  } = {}) {
    this.config = config;
    this.appConfig = appConfig;
    this.accountStore = accountStore;
    this.now = now;
    this.rooms = new Map();
    this.getOrCreatePublicRoom(appConfig.matchmaking.defaultRegion);
  }

  getOrCreatePublicRoom(regionId = this.appConfig.matchmaking.defaultRegion) {
    const roomId = `public-${regionId}`;
    const existing = this.rooms.get(roomId);
    if (existing) {
      return existing;
    }
    return this.createRoomInternal({
      id: roomId,
      name: "FFA Public",
      type: "public",
      regionId,
      maxPlayers: this.appConfig.matchmaking.maxPlayersPerRoom
    });
  }

  chooseQuickplayRoom(regionId = this.appConfig.matchmaking.defaultRegion) {
    const publicRooms = [...this.rooms.values()].filter(
      (room) => room.type === "public" && room.regionId === regionId && !room.isFull()
    );
    publicRooms.sort((a, b) => b.getHumanCount() - a.getHumanCount());
    if (publicRooms[0]) {
      return publicRooms[0];
    }
    if (this.rooms.size >= this.appConfig.matchmaking.maxRooms) {
      return this.getOrCreatePublicRoom(regionId);
    }
    const count = [...this.rooms.values()].filter((room) => room.type === "public" && room.regionId === regionId).length;
    return this.createRoomInternal({
      id: `public-${regionId}-${count + 1}`,
      name: `FFA Public ${count + 1}`,
      type: "public",
      regionId,
      maxPlayers: this.appConfig.matchmaking.maxPlayersPerRoom
    });
  }

  createCustomRoom({ name, regionId = this.appConfig.matchmaking.defaultRegion, maxPlayers } = {}) {
    const customRooms = [...this.rooms.values()].filter((room) => room.type === "custom").length;
    if (this.rooms.size >= this.appConfig.matchmaking.maxRooms || customRooms >= this.appConfig.matchmaking.maxRooms - 1) {
      const error = new Error("Room limit reached.");
      error.status = 409;
      throw error;
    }
    const cleanName = sanitizeRoomName(name, this.appConfig);
    return this.createRoomInternal({
      id: createRoomId(),
      name: cleanName,
      type: "custom",
      regionId,
      maxPlayers: clampMaxPlayers(maxPlayers, this.appConfig)
    });
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) ?? null;
  }

  listRooms() {
    return [...this.rooms.values()]
      .sort((a, b) => a.type.localeCompare(b.type) || a.createdAtMs - b.createdAtMs)
      .map((room) => room.getSummary());
  }

  stepAll(dtSeconds) {
    for (const room of this.rooms.values()) {
      room.step(dtSeconds);
    }
    this.cleanupInactiveRooms();
  }

  cleanupInactiveRooms() {
    const ttl = this.appConfig.matchmaking.inactiveRoomTtlMs;
    for (const [roomId, room] of this.rooms) {
      if (room.type === "public") {
        continue;
      }
      const emptyForMs = room.game.timeMs - room.lastHumanAtMs;
      if (room.clients.size === 0 && emptyForMs >= ttl) {
        this.rooms.delete(roomId);
      }
    }
  }

  applyDeveloperLevel(accountId, level) {
    const updated = [];
    for (const room of this.rooms.values()) {
      const roomUpdates = room.game.setDeveloperLevelForAccount(accountId, level);
      for (const update of roomUpdates) {
        updated.push({
          roomId: room.id,
          roomName: room.name,
          ...update
        });
      }
    }
    return {
      ok: updated.length > 0,
      level: Math.max(1, Math.min(this.config.upgrades.maxPlayerLevel, Math.trunc(Number(level) || 1))),
      updated
    };
  }

  getStatus() {
    const regions = this.appConfig.matchmaking.regions.map((region) => ({
      ...region,
      rooms: [...this.rooms.values()].filter((room) => room.regionId === region.id).length,
      players: [...this.rooms.values()]
        .filter((room) => room.regionId === region.id)
        .reduce((sum, room) => sum + room.clients.size, 0)
    }));
    return {
      defaultRegion: this.appConfig.matchmaking.defaultRegion,
      regions,
      rooms: this.listRooms()
    };
  }

  getDebugState() {
    return {
      roomCount: this.rooms.size,
      rooms: this.listRooms()
    };
  }

  createRoomInternal({ id, name, type, regionId, maxPlayers }) {
    const room = new RoomSession({
      id,
      name,
      type,
      regionId,
      maxPlayers,
      config: this.config,
      appConfig: this.appConfig,
      accountStore: this.accountStore,
      nowMs: this.now()
    });
    this.rooms.set(room.id, room);
    return room;
  }
}

export function sanitizeRoomName(name, appConfig = APP_CONFIG) {
  const clean = String(name ?? "")
    .replace(/[^\w \-.]/g, "")
    .trim()
    .slice(0, appConfig.matchmaking.customRoomNameMax);
  return clean || "Custom Room";
}

function createRoomId() {
  return `room-${randomBytes(4).toString("hex")}`;
}

function clampMaxPlayers(value, appConfig) {
  const numeric = Math.trunc(Number(value) || appConfig.matchmaking.maxPlayersPerRoom);
  return Math.max(2, Math.min(appConfig.matchmaking.maxPlayersPerRoom, numeric));
}
