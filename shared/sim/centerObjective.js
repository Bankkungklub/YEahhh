import { WORLD_CONTENT_CONFIG } from "../config/worldContentConfig.js";

const RECENT_KILL_LIMIT = 8;

export function createCenterObjectiveState() {
  return {
    shapeId: null,
    state: "down",
    respawnAtMs: 0,
    lastKilledAtMs: 0,
    lastKillerName: "",
    contributors: new Map(),
    paidShapeIds: new Set(),
    metrics: createCenterObjectiveMetrics()
  };
}

export function createCenterObjectiveMetrics() {
  return {
    spawnedAtMs: 0,
    lastLifeMs: 0,
    kills: 0,
    totalDamage: 0,
    humanDamage: 0,
    botDamage: 0,
    contributorsPeak: 0,
    lastContributors: 0,
    lastHumanDamage: 0,
    lastBotDamage: 0,
    lastRewardXp: 0,
    lastRewardCoins: 0,
    lastKillerKind: "unknown",
    recentKills: []
  };
}

export function ensureCenterObjectiveMetrics(state) {
  if (!state.metrics) {
    state.metrics = createCenterObjectiveMetrics();
  }
  if (!Array.isArray(state.metrics.recentKills)) {
    state.metrics.recentKills = [];
  }
  return state.metrics;
}

export function resetCenterObjectiveLifeMetrics(state, spawnedAtMs = 0) {
  const metrics = ensureCenterObjectiveMetrics(state);
  metrics.spawnedAtMs = Math.max(0, Math.round(Number(spawnedAtMs) || 0));
  metrics.totalDamage = 0;
  metrics.humanDamage = 0;
  metrics.botDamage = 0;
  metrics.contributorsPeak = 0;
  return metrics;
}

export function getWorldCenter(world, objective = WORLD_CONTENT_CONFIG.centerObjective) {
  return {
    x: world.width * objective.xRatio,
    y: world.height * objective.yRatio
  };
}

export function getCenterBlockedZones(
  gameConfig,
  radius = WORLD_CONTENT_CONFIG.centerObjective.spawnExclusionRadius,
  objective = WORLD_CONTENT_CONFIG.centerObjective
) {
  if (!objective.enabled) {
    return [];
  }
  const center = getWorldCenter(gameConfig.world, objective);
  return [{ ...center, radius }];
}

export function isInsideBlockedZone(candidate, blockedZones = []) {
  if (!candidate || blockedZones.length === 0) {
    return false;
  }
  const radius = Math.max(0, Number(candidate.radius) || 0);
  for (const zone of blockedZones) {
    const dx = candidate.x - zone.x;
    const dy = candidate.y - zone.y;
    const limit = radius + Math.max(0, Number(zone.radius) || 0);
    if (dx * dx + dy * dy < limit * limit) {
      return true;
    }
  }
  return false;
}

export function isCenterObjectiveShape(shape, objective = WORLD_CONTENT_CONFIG.centerObjective) {
  return Boolean(
    shape &&
    (shape.isCenterObjective || shape.shapeType === objective.shapeType)
  );
}

export function recordCenterObjectiveDamage(state, ownerId, amount, ownerKind = "unknown") {
  if (!state || !ownerId) {
    return;
  }
  const safeAmount = Math.max(0, Number(amount) || 0);
  if (safeAmount <= 0) {
    return;
  }
  state.contributors.set(ownerId, (state.contributors.get(ownerId) ?? 0) + safeAmount);
  const metrics = ensureCenterObjectiveMetrics(state);
  metrics.totalDamage += safeAmount;
  if (ownerKind === "player") {
    metrics.humanDamage += safeAmount;
  } else if (ownerKind === "bot") {
    metrics.botDamage += safeAmount;
  }
  metrics.contributorsPeak = Math.max(metrics.contributorsPeak, state.contributors.size);
}

export function completeCenterObjectiveMetrics(state, {
  killedAtMs = 0,
  rewards = [],
  killerKind = "unknown"
} = {}) {
  const metrics = ensureCenterObjectiveMetrics(state);
  const safeKilledAtMs = Math.max(0, Math.round(Number(killedAtMs) || 0));
  const rewardXp = rewards.reduce((sum, reward) => sum + Math.max(0, Number(reward.xp) || 0), 0);
  const rewardCoins = rewards.reduce((sum, reward) => sum + Math.max(0, Number(reward.coins) || 0), 0);
  const lifeMs = Math.max(0, safeKilledAtMs - metrics.spawnedAtMs);
  const sample = {
    killedAtMs: safeKilledAtMs,
    lifeMs,
    contributors: state.contributors?.size ?? 0,
    humanDamage: Math.round(metrics.humanDamage),
    botDamage: Math.round(metrics.botDamage),
    rewardXp: Math.round(rewardXp),
    rewardCoins: Math.round(rewardCoins),
    killerKind: sanitizeKind(killerKind)
  };

  metrics.kills += 1;
  metrics.lastLifeMs = lifeMs;
  metrics.lastContributors = sample.contributors;
  metrics.lastHumanDamage = sample.humanDamage;
  metrics.lastBotDamage = sample.botDamage;
  metrics.lastRewardXp = sample.rewardXp;
  metrics.lastRewardCoins = sample.rewardCoins;
  metrics.lastKillerKind = sample.killerKind;
  metrics.recentKills.push(sample);
  if (metrics.recentKills.length > RECENT_KILL_LIMIT) {
    metrics.recentKills.splice(0, metrics.recentKills.length - RECENT_KILL_LIMIT);
  }
  return sample;
}

export function getCenterObjectiveMetricsSnapshot(state) {
  const metrics = ensureCenterObjectiveMetrics(state);
  return {
    spawnedAtMs: Math.round(metrics.spawnedAtMs),
    lastLifeMs: Math.round(metrics.lastLifeMs),
    kills: Math.round(metrics.kills),
    totalDamage: Math.round(metrics.totalDamage),
    humanDamage: Math.round(metrics.humanDamage),
    botDamage: Math.round(metrics.botDamage),
    contributorsPeak: Math.round(metrics.contributorsPeak),
    lastContributors: Math.round(metrics.lastContributors),
    lastHumanDamage: Math.round(metrics.lastHumanDamage),
    lastBotDamage: Math.round(metrics.lastBotDamage),
    lastRewardXp: Math.round(metrics.lastRewardXp),
    lastRewardCoins: Math.round(metrics.lastRewardCoins),
    lastKillerKind: metrics.lastKillerKind,
    recentKills: metrics.recentKills.map((sample) => ({ ...sample }))
  };
}

export function calculateCenterObjectiveRewards({
  contributors,
  killerId = "",
  objective = WORLD_CONTENT_CONFIG.centerObjective
}) {
  const entries = normalizeContributorEntries(contributors);
  const totalDamage = entries.reduce((sum, [, damage]) => sum + damage, 0);
  if (totalDamage <= 0) {
    return [];
  }

  const rewards = [];
  for (const [tankId, damage] of entries) {
    const share = damage / totalDamage;
    if (share < objective.contributionMinShare && tankId !== killerId) {
      continue;
    }
    const sharedXp = Math.floor(objective.xp * objective.sharedRewardRatio * share);
    const sharedScore = Math.floor(objective.score * objective.sharedRewardRatio * share);
    const lastHitXp = tankId === killerId ? Math.floor(objective.xp * objective.lastHitBonusRatio) : 0;
    const lastHitScore = tankId === killerId ? Math.floor(objective.score * objective.lastHitBonusRatio) : 0;
    rewards.push({
      tankId,
      damage,
      share,
      xp: sharedXp + lastHitXp,
      score: sharedScore + lastHitScore,
      coins: Math.floor(objective.coinReward * share),
      lastHitBonusXp: lastHitXp
    });
  }
  return rewards;
}

export function getCenterObjectiveBotTargetWeight(profileId, objective = WORLD_CONTENT_CONFIG.centerObjective) {
  return objective.botTargetWeight[profileId] ?? 0.4;
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
