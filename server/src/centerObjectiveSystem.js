import { WORLD_CONTENT_CONFIG } from "../../shared/config/worldContentConfig.js";
import {
  calculateCenterObjectiveRewards,
  completeCenterObjectiveMetrics,
  createCenterObjectiveState,
  getCenterObjectiveMetricsSnapshot,
  getWorldCenter,
  isCenterObjectiveShape,
  recordCenterObjectiveDamage,
  resetCenterObjectiveLifeMetrics
} from "../../shared/sim/centerObjective.js";
import { createShape, refreshTankStats } from "../../shared/sim/entityFactory.js";
import { addXp } from "../../shared/sim/progression.js";
import { refreshClassUnlocks } from "../../shared/sim/tankClasses.js";

export function ensureCenterObjectiveState(game) {
  if (!game.centerObjective) {
    game.centerObjective = createCenterObjectiveState();
  }
  return game.centerObjective;
}

export function maintainCenterObjective(game) {
  const state = ensureCenterObjectiveState(game);
  const objective = WORLD_CONTENT_CONFIG.centerObjective;
  if (!objective.enabled) {
    return null;
  }

  if (state.state === "alive") {
    const existing = state.shapeId ? game.shapes.get(state.shapeId) : null;
    if (existing && existing.state === "alive") {
      return existing;
    }
    state.state = "down";
    state.shapeId = null;
    state.respawnAtMs = Math.max(state.respawnAtMs, game.timeMs + objective.respawnMs);
    state.contributors.clear();
  }

  if (game.timeMs < state.respawnAtMs) {
    return null;
  }

  const shape = createCenterObjectiveShape(game);
  game.shapes.set(shape.id, shape);
  state.shapeId = shape.id;
  state.state = "alive";
  state.respawnAtMs = 0;
  state.contributors.clear();
  resetCenterObjectiveLifeMetrics(state, game.timeMs);
  return shape;
}

export function createCenterObjectiveShape(game) {
  const objective = WORLD_CONTENT_CONFIG.centerObjective;
  const point = getWorldCenter(game.config.world, objective);
  const shape = createShape({
    id: game.nextEntityId("alpha"),
    shapeType: objective.shapeType,
    x: point.x,
    y: point.y,
    config: game.config
  });
  shape.isCenterObjective = true;
  shape.spawnable = false;
  shape.xp = objective.xp;
  shape.maxHp = objective.hp;
  shape.hp = objective.hp;
  shape.radius = objective.radius;
  return shape;
}

export function recordObjectiveHit(game, shape, projectile, appliedDamage) {
  if (!isCenterObjectiveShape(shape)) {
    return;
  }
  const state = ensureCenterObjectiveState(game);
  const owner = game.tanks.get(projectile.ownerId);
  recordCenterObjectiveDamage(state, projectile.ownerId, appliedDamage, owner?.kind ?? projectile.ownerKind);
}

export function completeCenterObjectiveIfNeeded(game, shape, projectile) {
  if (!isCenterObjectiveShape(shape)) {
    return false;
  }

  const state = ensureCenterObjectiveState(game);
  if (state.paidShapeIds.has(shape.id)) {
    return true;
  }
  state.paidShapeIds.add(shape.id);
  const killerId = projectile.ownerId;
  const killer = game.tanks.get(killerId);
  const rewards = calculateCenterObjectiveRewards({
    contributors: state.contributors,
    killerId,
    objective: WORLD_CONTENT_CONFIG.centerObjective
  });

  for (const reward of rewards) {
    const tank = game.tanks.get(reward.tankId);
    if (!tank) {
      continue;
    }
    addXp(tank, reward.xp, reward.score, game.config);
    if (tank.kind === "player") {
      game.grantCoins(tank, reward.coins, "centerObjective");
    }
    refreshClassUnlocks(tank);
    refreshTankStats(tank, game.config);
  }

  state.shapeId = null;
  state.state = "down";
  state.lastKilledAtMs = game.timeMs;
  state.lastKillerName = killer?.name ?? projectile.ownerName ?? "";
  completeCenterObjectiveMetrics(state, {
    killedAtMs: game.timeMs,
    rewards,
    killerKind: killer?.kind ?? "unknown"
  });
  state.respawnAtMs = game.timeMs + WORLD_CONTENT_CONFIG.centerObjective.respawnMs;
  state.contributors.clear();
  return true;
}

export function getCenterObjectiveSnapshot(game) {
  const state = ensureCenterObjectiveState(game);
  const objective = WORLD_CONTENT_CONFIG.centerObjective;
  if (!objective.enabled) {
    return { enabled: false, state: "disabled" };
  }

  const point = getWorldCenter(game.config.world, objective);
  const shape = state.shapeId ? game.shapes.get(state.shapeId) : null;
  if (state.state === "alive" && shape) {
    return {
      enabled: true,
      state: "alive",
      shapeId: shape.id,
      shapeType: shape.shapeType,
      x: Math.round(shape.x * 10) / 10,
      y: Math.round(shape.y * 10) / 10,
      radius: shape.radius,
      hp: Math.max(0, Math.round(shape.hp)),
      maxHp: shape.maxHp,
      xp: objective.xp,
      coinReward: objective.coinReward,
      respawnInMs: 0,
      contributors: state.contributors.size,
      lastKillerName: state.lastKillerName,
      metrics: getCenterObjectiveMetricsSnapshot(state)
    };
  }

  return {
    enabled: true,
    state: "down",
    shapeId: null,
    shapeType: objective.shapeType,
    x: point.x,
    y: point.y,
    radius: objective.radius,
    hp: 0,
    maxHp: objective.hp,
    xp: objective.xp,
    coinReward: objective.coinReward,
    respawnInMs: Math.max(0, Math.ceil(state.respawnAtMs - game.timeMs)),
    contributors: 0,
    lastKillerName: state.lastKillerName,
    metrics: getCenterObjectiveMetricsSnapshot(state)
  };
}

export function getCenterObjectiveDebug(game) {
  return getCenterObjectiveSnapshot(game);
}

export function getShapeTypeCounts(game) {
  const counts = {};
  for (const shape of game.shapes.values()) {
    counts[shape.shapeType] = (counts[shape.shapeType] ?? 0) + 1;
  }
  return counts;
}
