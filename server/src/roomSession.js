import { APP_CONFIG } from "../../shared/config/appConfig.js";
import { GAME_CONFIG } from "../../shared/config/gameConfig.js";
import { ServerGame } from "./serverGame.js";
import { performance } from "node:perf_hooks";

export class RoomSession {
  constructor({
    id,
    name,
    type = "public",
    regionId = APP_CONFIG.matchmaking.defaultRegion,
    maxPlayers = APP_CONFIG.matchmaking.maxPlayersPerRoom,
    config = GAME_CONFIG,
    appConfig = APP_CONFIG,
    accountStore = null,
    nowMs = 0
  }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.regionId = regionId;
    this.maxPlayers = maxPlayers;
    this.createdAtMs = nowMs;
    this.lastHumanAtMs = nowMs;
    this.clients = new Map();
    this.game = new ServerGame({ config, appConfig, accountStore });
    this.stepMetrics = {
      lastMs: 0,
      avgMs: 0,
      maxMs: 0,
      samples: 0
    };
  }

  addClient(client) {
    this.clients.set(client.id, client);
    this.lastHumanAtMs = this.game.timeMs;
  }

  removeClient(clientId) {
    this.clients.delete(clientId);
    if (this.clients.size === 0) {
      this.lastHumanAtMs = this.game.timeMs;
    }
  }

  isFull() {
    return this.clients.size >= this.maxPlayers;
  }

  step(dtSeconds) {
    const startedAt = performance.now();
    this.game.step(dtSeconds);
    const elapsed = performance.now() - startedAt;
    this.stepMetrics.lastMs = roundMetric(elapsed);
    this.stepMetrics.avgMs = roundMetric(
      this.stepMetrics.samples === 0
        ? elapsed
        : this.stepMetrics.avgMs * 0.95 + elapsed * 0.05
    );
    this.stepMetrics.maxMs = roundMetric(Math.max(elapsed, this.stepMetrics.maxMs * 0.995));
    this.stepMetrics.samples += 1;
  }

  getHumanCount() {
    return this.clients.size;
  }

  getSummary() {
    const counts = this.game.createSnapshot().counts;
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      regionId: this.regionId,
      players: this.clients.size,
      maxPlayers: this.maxPlayers,
      bots: counts.bots,
      shapes: counts.shapes,
      tick: this.game.tick,
      stepMs: this.stepMetrics,
      botProfiles: this.game.getBotProfileDebugState(),
      classCounts: this.game.getClassDebugCounts(),
      botClassCounts: this.game.getBotClassDebugState(),
      botBehavior: this.game.getBotBehaviorDebugState(),
      centerObjective: this.game.getCenterObjectiveDebugState(),
      shapeCounts: this.game.getShapeTypeDebugState(),
      performance: this.game.getPerformanceDebugState()
    };
  }
}

function roundMetric(value) {
  return Math.round(value * 100) / 100;
}
