import { EVENT_OBJECTIVE_CONFIG } from "../../shared/config/eventObjectiveConfig.js";
import { COMBAT_FEEL_CONFIG } from "../../shared/config/combatFeelConfig.js";
import { getCenterBlockedZones, getWorldCenter, isInsideBlockedZone } from "../../shared/sim/centerObjective.js";
import { wouldOverlapAny } from "../../shared/sim/collision.js";
import { createShape, refreshTankStats } from "../../shared/sim/entityFactory.js";
import { addXp } from "../../shared/sim/progression.js";
import { refreshClassUnlocks } from "../../shared/sim/tankClasses.js";
import {
  calculateEventObjectiveRewards,
  chooseEventType,
  completeEventObjective,
  createEventObjectiveRecord,
  createEventObjectiveState,
  expireEventObjective,
  getEventMaxActive,
  getEventObjectiveDebug as getEventObjectiveStateDebug,
  getEventObjectiveSnapshot,
  getEventSpawnCooldownMs,
  getEventObjectiveType,
  isEventDirectorReady,
  recordEventObjectiveHit as recordEventHit
} from "../../shared/sim/eventObjectives.js";

export function ensureEventObjectiveState(game) {
  if (!game.eventObjectives) {
    game.eventObjectives = createEventObjectiveState();
  }
  return game.eventObjectives;
}

export function maintainEventObjectives(game) {
  const state = ensureEventObjectiveState(game);
  if (!EVENT_OBJECTIVE_CONFIG.enabled || !state.enabled) {
    return null;
  }

  expireStaleEventObjectives(game, state);

  const highestHumanLevel = getHighestHumanLevel(game);
  const aliveHumans = getAliveHumanTanks(game).length;
  if (aliveHumans <= 0) {
    return null;
  }

  const maxActive = getEventMaxActive(highestHumanLevel);
  if (state.active.size >= maxActive) {
    return null;
  }
  if (!isEventDirectorReady({
    state,
    highestHumanLevel,
    matchAgeMs: game.timeMs,
    nowMs: game.timeMs
  })) {
    return null;
  }

  const objectiveType = chooseEventType({
    highestHumanLevel,
    matchAgeMs: game.timeMs,
    rng: game.rng
  });
  if (!objectiveType) {
    state.nextSpawnAtMs = game.timeMs + EVENT_OBJECTIVE_CONFIG.director.retryMs;
    return null;
  }

  const point = findEventObjectiveSpawnPoint(game, objectiveType);
  if (!point) {
    state.nextSpawnAtMs = game.timeMs + EVENT_OBJECTIVE_CONFIG.director.retryMs;
    return null;
  }

  const shape = createEventObjectiveShape(game, objectiveType, point, aliveHumans);
  game.shapes.set(shape.id, shape);
  state.active.set(shape.eventObjectiveId, shape.eventObjective);
  state.metrics.spawned += 1;
  state.nextSpawnAtMs = game.timeMs + getEventSpawnCooldownMs({
    highestHumanLevel,
    matchAgeMs: game.timeMs
  });
  return shape;
}

export function recordEventShapeHit(game, shape, source, appliedDamage) {
  if (!isEventObjectiveShape(shape)) {
    return null;
  }
  const owner = game.tanks.get(source?.ownerId);
  return recordEventHit({
    state: ensureEventObjectiveState(game),
    eventId: shape.eventObjectiveId,
    tankId: source?.ownerId,
    amount: appliedDamage,
    tankKind: owner?.kind ?? source?.ownerKind ?? "unknown"
  });
}

export function completeEventShapeIfNeeded(game, shape, source) {
  if (!isEventObjectiveShape(shape)) {
    return false;
  }

  const state = ensureEventObjectiveState(game);
  if (state.paidShapeIds.has(shape.id)) {
    return true;
  }
  state.paidShapeIds.add(shape.id);

  const event = state.active.get(shape.eventObjectiveId);
  if (!event) {
    return true;
  }

  const killerId = source?.ownerId ?? "";
  const killer = game.tanks.get(killerId);
  const rewards = calculateEventObjectiveRewards({ event, killerId });
  for (const reward of rewards) {
    const tank = game.tanks.get(reward.tankId);
    if (!tank) {
      continue;
    }
    addXp(tank, reward.xp, reward.score, game.config);
    if (tank.kind === "player") {
      game.grantCoins(tank, reward.coins, "eventObjective");
    }
    refreshClassUnlocks(tank);
    refreshTankStats(tank, game.config);
  }

  completeEventObjective({
    state,
    eventId: event.id,
    killedAtMs: game.timeMs,
    killerId,
    killerKind: killer?.kind ?? source?.ownerKind ?? "unknown",
    rewards
  });
  spawnEventDeathBurst(game, shape);
  return true;
}

export function getEventObjectiveSnapshots(game) {
  const state = ensureEventObjectiveState(game);
  const snapshots = [];
  for (const event of state.active.values()) {
    const shape = game.shapes.get(event.shapeId);
    if (!shape || shape.state !== "alive") {
      continue;
    }
    const snapshot = getEventObjectiveSnapshot({ event, shape, nowMs: game.timeMs });
    if (snapshot) {
      snapshots.push(snapshot);
    }
  }
  return snapshots.sort((a, b) => a.expiresAtMs - b.expiresAtMs || a.id.localeCompare(b.id));
}

export function getEventObjectiveDebug(game) {
  const state = ensureEventObjectiveState(game);
  return {
    ...getEventObjectiveStateDebug(state),
    active: getEventObjectiveSnapshots(game)
  };
}

export function getEventShapeDamageMultiplier(shape) {
  if (!isEventObjectiveShape(shape)) {
    return 1;
  }
  const multiplier = Number(shape.eventIncomingDamageMultiplier);
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
}

export function getEventShapeContactMultiplier(shape) {
  if (!isEventObjectiveShape(shape)) {
    return 1;
  }
  const multiplier = Number(shape.eventContactMultiplier);
  return Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
}

export function isEventObjectiveShape(shape) {
  return Boolean(shape?.isEventObjective && shape.eventObjectiveId);
}

function createEventObjectiveShape(game, objectiveType, point, aliveHumans) {
  const eventId = game.nextEntityId("event");
  const shapeId = game.nextEntityId("eventShape");
  const event = createEventObjectiveRecord({
    id: eventId,
    typeId: objectiveType.id,
    shapeId,
    x: point.x,
    y: point.y,
    nowMs: game.timeMs,
    aliveHumans
  });
  const shape = createShape({
    id: shapeId,
    shapeType: objectiveType.shapeType,
    x: point.x,
    y: point.y,
    config: game.config
  });

  shape.isEventObjective = true;
  shape.spawnable = false;
  shape.eventObjectiveId = event.id;
  shape.eventType = objectiveType.id;
  shape.eventLabel = objectiveType.label;
  shape.eventShortLabel = objectiveType.shortLabel;
  shape.eventThreatLevel = objectiveType.threatLevel;
  shape.eventSpawnedAtMs = event.spawnedAtMs;
  shape.eventExpiresAtMs = event.expiresAtMs;
  shape.eventRewardXp = objectiveType.rewardXp;
  shape.eventCoinReward = objectiveType.coinReward;
  shape.eventContactMultiplier = objectiveType.contactMultiplier;
  shape.eventIncomingDamageMultiplier = objectiveType.incomingDamageMultiplier;
  shape.eventBotInterestMultiplier = objectiveType.botInterestMultiplier;
  shape.eventColor = objectiveType.ui.color;
  shape.eventOutlineColor = objectiveType.ui.outlineColor;
  shape.eventPulseColor = objectiveType.ui.pulseColor;
  shape.eventMinimapSize = objectiveType.ui.minimapSize;
  shape.eventHasDeathBurst = Boolean(objectiveType.deathBurst?.enabled);
  shape.eventDeathBurstWarningMs = objectiveType.deathBurst?.warningMs ?? 0;
  shape.eventObjective = event;
  shape.radius = objectiveType.radius;
  shape.maxHp = event.maxHp;
  shape.hp = event.maxHp;
  shape.xp = objectiveType.rewardXp;
  shape.color = objectiveType.ui.color;
  return shape;
}

function expireStaleEventObjectives(game, state) {
  for (const event of [...state.active.values()]) {
    const shape = game.shapes.get(event.shapeId);
    const shapeMissing = !shape || shape.state !== "alive";
    const expired = game.timeMs >= event.expiresAtMs;
    if (!shapeMissing && !expired) {
      continue;
    }
    if (!shapeMissing) {
      shape.state = "expired";
      game.shapes.delete(shape.id);
    }
    expireEventObjective({
      state,
      eventId: event.id,
      expiredAtMs: game.timeMs
    });
    if (state.nextSpawnAtMs < game.timeMs) {
      state.nextSpawnAtMs = game.timeMs + EVENT_OBJECTIVE_CONFIG.director.retryMs;
    }
  }
}

function findEventObjectiveSpawnPoint(game, objectiveType) {
  const director = EVENT_OBJECTIVE_CONFIG.director;
  const center = getWorldCenter(game.config.world);
  const minRadius = objectiveType.spawnRadiusMin ?? director.spawnRadiusMin;
  const maxRadius = objectiveType.spawnRadiusMax ?? director.spawnRadiusMax;
  const blockedZones = getCenterBlockedZones(game.config, Math.max(900, director.spawnRadiusMin * 0.42));
  const aliveHumans = getAliveHumanTanks(game);
  const liveShapes = [...game.shapes.values()].filter((shape) => shape.state === "alive");
  const margin = Math.max(100, objectiveType.radius + 36);

  for (let attempt = 0; attempt < director.spawnAttempts; attempt += 1) {
    const angle = game.rng() * Math.PI * 2;
    const radius = minRadius + (maxRadius - minRadius) * game.rng();
    const point = {
      x: clamp(center.x + Math.cos(angle) * radius, margin, game.config.world.width - margin),
      y: clamp(center.y + Math.sin(angle) * radius, margin, game.config.world.height - margin),
      radius: objectiveType.radius
    };
    if (isInsideBlockedZone(point, blockedZones)) {
      continue;
    }
    if (wouldOverlapAny(point, aliveHumans, director.playerSafetyRadius)) {
      continue;
    }
    if (wouldOverlapAny(point, liveShapes, director.shapeSafetyRadius)) {
      continue;
    }
    return { x: point.x, y: point.y };
  }

  return null;
}

function spawnEventDeathBurst(game, shape) {
  const type = getEventObjectiveType(shape.eventType);
  const burst = type?.deathBurst;
  if (!burst?.enabled) {
    return;
  }
  const visual = COMBAT_FEEL_CONFIG.projectileVisuals.spark;
  const count = Math.max(1, Math.min(16, Math.trunc(burst.count)));
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count;
    const projectile = {
      id: game.nextEntityId("eventSpark"),
      type: "projectile",
      kind: "spark",
      behavior: "bullet",
      ownerId: shape.eventObjectiveId,
      ownerName: shape.eventLabel,
      ownerKind: "eventObjective",
      x: shape.x,
      y: shape.y,
      prevX: shape.x,
      prevY: shape.y,
      vx: Math.cos(angle) * burst.speed,
      vy: Math.sin(angle) * burst.speed,
      angle,
      radius: burst.radius,
      damage: burst.damage,
      ageMs: 0,
      ttlMs: burst.ttlMs,
      createdAtMs: game.timeMs,
      spawnX: shape.x,
      spawnY: shape.y,
      state: "active",
      hitsShapes: false,
      fillColor: visual.fill,
      coreColor: visual.core,
      trailColor: visual.trail,
      trailMs: visual.trailMs,
      trailAlpha: visual.trailAlpha,
      outlineColor: visual.outlineColor,
      outlineWidth: visual.outlineWidth,
      pulseColor: visual.pulseColor,
      impactStyle: visual.impactStyle
    };
    game.projectiles.set(projectile.id, projectile);
    if (game.performanceStats) {
      game.performanceStats.explosionSparksCreated += 1;
    }
  }
}

function getHighestHumanLevel(game) {
  const humans = [...game.tanks.values()].filter((tank) => tank.kind === "player" && tank.disconnectedAtMs === null);
  return humans.reduce((highest, tank) => Math.max(highest, tank.level ?? 1), 1);
}

function getAliveHumanTanks(game) {
  return [...game.tanks.values()].filter((tank) => (
    tank.kind === "player" &&
    tank.disconnectedAtMs === null &&
    tank.state === "alive"
  ));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
