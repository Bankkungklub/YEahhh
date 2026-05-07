import { EVENT_OBJECTIVE_CONFIG } from "../config/eventObjectiveConfig.js";

const EVENT_STATE = Object.freeze({
  IDLE: "idle",
  ACTIVE: "active",
  COMPLETED: "completed",
  EXPIRED: "expired"
});

export function createEventObjectiveState(config = EVENT_OBJECTIVE_CONFIG) {
  return {
    enabled: Boolean(config.enabled),
    nextSpawnAtMs: config.director.firstSpawnMs,
    serial: 0,
    active: new Map(),
    paidShapeIds: new Set(),
    metrics: createEventObjectiveMetrics()
  };
}

export function createEventObjectiveMetrics() {
  return {
    spawned: 0,
    completed: 0,
    expired: 0,
    totalDamage: 0,
    humanDamage: 0,
    botDamage: 0,
    totalRewardXp: 0,
    totalRewardCoins: 0,
    totalLifetimeMs: 0,
    recentSamples: []
  };
}

export function getEventObjectiveType(typeId, config = EVENT_OBJECTIVE_CONFIG) {
  return config.objectives?.[typeId] ?? null;
}

export function getEventObjectiveTypes(config = EVENT_OBJECTIVE_CONFIG) {
  return Object.values(config.objectives ?? {});
}

export function getPlayerCountScale(aliveHumans = 1) {
  return clamp(1 + (Math.max(1, aliveHumans) - 1) * 0.18, 1, 1.72);
}

export function getEventDirectorReadiness({
  highestHumanLevel = 1,
  matchAgeMs = 0,
  config = EVENT_OBJECTIVE_CONFIG
} = {}) {
  const levelRatio = clamp(highestHumanLevel / 45, 0, 1);
  const ageRatio = clamp(matchAgeMs / Math.max(1, config.director.readinessMatchAgeMs), 0, 1);
  return Math.max(levelRatio, ageRatio);
}

export function getEventSpawnCooldownMs({
  highestHumanLevel = 1,
  matchAgeMs = 0,
  config = EVENT_OBJECTIVE_CONFIG
} = {}) {
  const readiness = getEventDirectorReadiness({ highestHumanLevel, matchAgeMs, config });
  return Math.round(lerp(config.director.cooldownMsMax, config.director.cooldownMsMin, readiness));
}

export function getEventMaxActive(highestHumanLevel = 1, config = EVENT_OBJECTIVE_CONFIG) {
  return highestHumanLevel >= config.director.lateLevelThreshold
    ? config.director.maxActiveLate
    : config.director.maxActiveEarly;
}

export function isEventDirectorReady({
  state,
  highestHumanLevel = 1,
  matchAgeMs = 0,
  nowMs = matchAgeMs,
  config = EVENT_OBJECTIVE_CONFIG
} = {}) {
  if (!config.enabled || !state?.enabled) {
    return false;
  }
  const reachedLevelGate = highestHumanLevel >= config.director.firstUnlockLevel;
  const reachedTimeGate = matchAgeMs >= config.director.firstSpawnMs;
  const hasNeverSpawned = (state.metrics?.spawned ?? 0) === 0 && (state.active?.size ?? 0) === 0;
  if (hasNeverSpawned) {
    return reachedLevelGate || reachedTimeGate;
  }
  return (reachedLevelGate || reachedTimeGate) && nowMs >= (state.nextSpawnAtMs ?? config.director.firstSpawnMs);
}

export function chooseEventType({
  highestHumanLevel = 1,
  matchAgeMs = 0,
  rng = Math.random,
  config = EVENT_OBJECTIVE_CONFIG
} = {}) {
  const eligible = getEventObjectiveTypes(config)
    .filter((type) => (
      type.weight > 0 &&
      (highestHumanLevel >= type.unlockLevel || matchAgeMs >= type.unlockMatchAgeMs)
    ));
  const totalWeight = eligible.reduce((sum, type) => sum + type.weight, 0);
  if (eligible.length === 0 || totalWeight <= 0) {
    return null;
  }

  let roll = rng() * totalWeight;
  for (const type of eligible) {
    roll -= type.weight;
    if (roll <= 0) {
      return type;
    }
  }
  return eligible[eligible.length - 1];
}

export function createEventObjectiveRecord({
  id,
  typeId,
  shapeId,
  x,
  y,
  nowMs = 0,
  aliveHumans = 1,
  config = EVENT_OBJECTIVE_CONFIG
}) {
  const type = getEventObjectiveType(typeId, config);
  if (!type) {
    throw new Error(`Unknown event objective type: ${typeId}`);
  }
  const playerCountScale = getPlayerCountScale(aliveHumans);
  return {
    id,
    typeId: type.id,
    shapeId,
    state: EVENT_STATE.ACTIVE,
    x,
    y,
    spawnedAtMs: Math.max(0, Math.round(Number(nowMs) || 0)),
    expiresAtMs: Math.max(0, Math.round(Number(nowMs) || 0)) + type.durationMs,
    maxHp: Math.round(type.hp * playerCountScale),
    rewardXp: type.rewardXp,
    scoreReward: type.scoreReward,
    coinReward: type.coinReward,
    playerCountScale,
    contributors: new Map(),
    totalDamage: 0,
    humanDamage: 0,
    botDamage: 0,
    contributorsPeak: 0,
    lastHitterId: "",
    lastHitterKind: "unknown",
    completedAtMs: 0,
    expiredAtMs: 0
  };
}

export function recordEventObjectiveHit({
  state,
  eventId,
  tankId,
  amount,
  tankKind = "unknown"
} = {}) {
  const event = state?.active?.get(eventId);
  if (!event || event.state !== EVENT_STATE.ACTIVE || !tankId) {
    return null;
  }
  const safeAmount = Math.max(0, Number(amount) || 0);
  if (safeAmount <= 0) {
    return event;
  }

  event.contributors.set(tankId, (event.contributors.get(tankId) ?? 0) + safeAmount);
  event.totalDamage += safeAmount;
  if (tankKind === "player") {
    event.humanDamage += safeAmount;
  } else if (tankKind === "bot") {
    event.botDamage += safeAmount;
  }
  event.contributorsPeak = Math.max(event.contributorsPeak, event.contributors.size);
  event.lastHitterId = tankId;
  event.lastHitterKind = sanitizeKind(tankKind);
  state.metrics.totalDamage += safeAmount;
  if (tankKind === "player") {
    state.metrics.humanDamage += safeAmount;
  } else if (tankKind === "bot") {
    state.metrics.botDamage += safeAmount;
  }
  return event;
}

export function calculateEventObjectiveRewards({
  event,
  killerId = "",
  config = EVENT_OBJECTIVE_CONFIG
} = {}) {
  if (!event) {
    return [];
  }
  const entries = normalizeContributorEntries(event.contributors);
  const totalDamage = entries.reduce((sum, [, damage]) => sum + damage, 0);
  if (totalDamage <= 0) {
    return [];
  }

  const rewards = [];
  for (const [tankId, damage] of entries) {
    const share = damage / totalDamage;
    if (share < config.rewards.contributionMinShare && tankId !== killerId) {
      continue;
    }
    const sharedRatio = config.rewards.sharedRewardRatio * share;
    const lastHitRatio = tankId === killerId ? config.rewards.lastHitBonusRatio : 0;
    const rewardRatio = sharedRatio + lastHitRatio;
    rewards.push({
      tankId,
      damage,
      share,
      xp: Math.floor(event.rewardXp * rewardRatio),
      score: Math.floor(event.scoreReward * rewardRatio),
      coins: Math.floor(event.coinReward * rewardRatio),
      lastHitBonusXp: tankId === killerId ? Math.floor(event.rewardXp * config.rewards.lastHitBonusRatio) : 0
    });
  }
  return rewards;
}

export function completeEventObjective({
  state,
  eventId,
  killedAtMs = 0,
  killerId = "",
  killerKind = "unknown",
  rewards = [],
  config = EVENT_OBJECTIVE_CONFIG
} = {}) {
  const event = state?.active?.get(eventId);
  if (!event || event.state !== EVENT_STATE.ACTIVE) {
    return null;
  }
  event.state = EVENT_STATE.COMPLETED;
  event.completedAtMs = Math.max(0, Math.round(Number(killedAtMs) || 0));
  const type = getEventObjectiveType(event.typeId, config);
  const sample = createEventSample({
    event,
    type,
    endedAtMs: event.completedAtMs,
    outcome: EVENT_STATE.COMPLETED,
    killerKind,
    killerId,
    rewards
  });
  state.active.delete(eventId);
  state.metrics.completed += 1;
  state.metrics.totalRewardXp += sample.rewardXp;
  state.metrics.totalRewardCoins += sample.rewardCoins;
  state.metrics.totalLifetimeMs += sample.lifeMs;
  appendRecentSample(state, sample, config);
  return sample;
}

export function expireEventObjective({
  state,
  eventId,
  expiredAtMs = 0,
  config = EVENT_OBJECTIVE_CONFIG
} = {}) {
  const event = state?.active?.get(eventId);
  if (!event || event.state !== EVENT_STATE.ACTIVE) {
    return null;
  }
  event.state = EVENT_STATE.EXPIRED;
  event.expiredAtMs = Math.max(0, Math.round(Number(expiredAtMs) || 0));
  const type = getEventObjectiveType(event.typeId, config);
  const sample = createEventSample({
    event,
    type,
    endedAtMs: event.expiredAtMs,
    outcome: EVENT_STATE.EXPIRED,
    killerKind: "unknown",
    rewards: []
  });
  state.active.delete(eventId);
  state.metrics.expired += 1;
  appendRecentSample(state, sample, config);
  return sample;
}

export function getEventObjectiveSnapshot({
  event,
  shape = null,
  nowMs = 0,
  config = EVENT_OBJECTIVE_CONFIG
} = {}) {
  if (!event) {
    return null;
  }
  const type = getEventObjectiveType(event.typeId, config);
  if (!type) {
    return null;
  }
  const hp = Math.max(0, Math.round(shape?.hp ?? event.maxHp));
  const maxHp = Math.max(1, Math.round(shape?.maxHp ?? event.maxHp));
  return {
    id: event.id,
    shapeId: event.shapeId,
    typeId: event.typeId,
    label: type.label,
    shortLabel: type.shortLabel,
    shapeType: type.shapeType,
    state: shape?.state ?? event.state,
    x: Math.round((shape?.x ?? event.x) * 10) / 10,
    y: Math.round((shape?.y ?? event.y) * 10) / 10,
    radius: shape?.radius ?? type.radius,
    hp,
    maxHp,
    hpRatio: hp / maxHp,
    rewardXp: type.rewardXp,
    coinReward: type.coinReward,
    threatLevel: type.threatLevel,
    contributors: event.contributors.size,
    expiresInMs: Math.max(0, Math.ceil(event.expiresAtMs - nowMs)),
    spawnedAtMs: event.spawnedAtMs,
    expiresAtMs: event.expiresAtMs,
    ui: {
      color: type.ui.color,
      outlineColor: type.ui.outlineColor,
      pulseColor: type.ui.pulseColor,
      minimapSize: type.ui.minimapSize,
      description: type.ui.description
    },
    deathBurst: type.deathBurst?.enabled ? {
      enabled: true,
      warningMs: type.deathBurst.warningMs
    } : { enabled: false }
  };
}

export function getEventObjectiveDebug(state, config = EVENT_OBJECTIVE_CONFIG) {
  const metrics = state?.metrics ?? createEventObjectiveMetrics();
  const completed = Math.max(0, metrics.completed);
  return {
    enabled: Boolean(state?.enabled),
    activeCount: state?.active?.size ?? 0,
    nextSpawnAtMs: Math.round(state?.nextSpawnAtMs ?? 0),
    spawned: Math.round(metrics.spawned),
    completed: Math.round(metrics.completed),
    expired: Math.round(metrics.expired),
    completionRate: completed / Math.max(1, metrics.spawned),
    avgLifetimeMs: completed > 0 ? Math.round(metrics.totalLifetimeMs / completed) : 0,
    totalDamage: Math.round(metrics.totalDamage),
    humanDamage: Math.round(metrics.humanDamage),
    botDamage: Math.round(metrics.botDamage),
    humanShare: metrics.humanDamage / Math.max(1, metrics.totalDamage),
    totalRewardXp: Math.round(metrics.totalRewardXp),
    totalRewardCoins: Math.round(metrics.totalRewardCoins),
    recentSamples: metrics.recentSamples.slice(-(config.director.recentSampleLimit ?? 8)).map((sample) => ({ ...sample }))
  };
}

function createEventSample({
  event,
  type,
  endedAtMs,
  outcome,
  killerKind = "unknown",
  killerId = "",
  rewards = []
}) {
  const rewardXp = rewards.reduce((sum, reward) => sum + Math.max(0, Number(reward.xp) || 0), 0);
  const rewardCoins = rewards.reduce((sum, reward) => sum + Math.max(0, Number(reward.coins) || 0), 0);
  return {
    id: event.id,
    typeId: event.typeId,
    label: type?.label ?? event.typeId,
    outcome,
    endedAtMs: Math.round(endedAtMs),
    lifeMs: Math.max(0, Math.round(endedAtMs - event.spawnedAtMs)),
    contributors: event.contributors.size,
    humanDamage: Math.round(event.humanDamage),
    botDamage: Math.round(event.botDamage),
    totalDamage: Math.round(event.totalDamage),
    rewardXp: Math.round(rewardXp),
    rewardCoins: Math.round(rewardCoins),
    killerKind: sanitizeKind(killerKind),
    killerId: String(killerId ?? "")
  };
}

function appendRecentSample(state, sample, config) {
  state.metrics.recentSamples.push(sample);
  const limit = Math.max(1, config.director.recentSampleLimit ?? 8);
  if (state.metrics.recentSamples.length > limit) {
    state.metrics.recentSamples.splice(0, state.metrics.recentSamples.length - limit);
  }
}

function normalizeContributorEntries(contributors) {
  const rawEntries = contributors instanceof Map
    ? [...contributors.entries()]
    : Object.entries(contributors ?? {});
  return rawEntries
    .map(([tankId, damage]) => [tankId, Math.max(0, Number(damage) || 0)])
    .filter(([, damage]) => damage > 0);
}

function sanitizeKind(value) {
  const kind = String(value ?? "unknown");
  return kind === "player" || kind === "bot" ? kind : "unknown";
}

function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
