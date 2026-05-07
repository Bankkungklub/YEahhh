const config = {
  version: "alpha-sector-events-v1",
  enabled: true,
  director: {
    firstSpawnMs: 75000,
    firstUnlockLevel: 8,
    readinessMatchAgeMs: 360000,
    cooldownMsMin: 65000,
    cooldownMsMax: 95000,
    maxActiveEarly: 1,
    maxActiveLate: 2,
    lateLevelThreshold: 30,
    spawnRadiusMin: 1800,
    spawnRadiusMax: 4200,
    spawnAttempts: 32,
    playerSafetyRadius: 650,
    shapeSafetyRadius: 180,
    retryMs: 10000,
    recentSampleLimit: 8
  },
  rewards: {
    contributionMinShare: 0.04,
    sharedRewardRatio: 0.8,
    lastHitBonusRatio: 0.2,
    xpPerHpMin: 1.1,
    xpPerHpMax: 2.55
  },
  bot: {
    eventInterestRange: 1600,
    humanDampenerRadius: 900,
    humanDampener: 0.72
  },
  objectives: {
    alphaShard: {
      id: "alphaShard",
      label: "Alpha Shard",
      shortLabel: "SHARD",
      shapeType: "pentagon",
      radius: 52,
      hp: 460,
      rewardXp: 760,
      scoreReward: 760,
      coinReward: 14,
      durationMs: 70000,
      unlockLevel: 8,
      unlockMatchAgeMs: 75000,
      weight: 0.42,
      threatLevel: 1,
      contactMultiplier: 0.65,
      incomingDamageMultiplier: 1,
      botInterestMultiplier: 0.78,
      spawnRadiusMin: 1800,
      spawnRadiusMax: 3900,
      ui: {
        color: "#65d6ad",
        outlineColor: "#253343",
        pulseColor: "rgba(101,214,173,0.34)",
        minimapSize: 6,
        alertMs: 2200,
        description: "Shared XP fragment. Safer than Alpha."
      }
    },
    volatileTriangle: {
      id: "volatileTriangle",
      label: "Volatile Triangle",
      shortLabel: "VOLATILE",
      shapeType: "triangle",
      radius: 46,
      hp: 210,
      rewardXp: 520,
      scoreReward: 520,
      coinReward: 10,
      durationMs: 60000,
      unlockLevel: 15,
      unlockMatchAgeMs: 120000,
      weight: 0.25,
      threatLevel: 3,
      contactMultiplier: 1.1,
      incomingDamageMultiplier: 1,
      botInterestMultiplier: 0.72,
      deathBurst: {
        enabled: true,
        count: 8,
        damage: 5,
        speed: 460,
        ttlMs: 520,
        radius: 5,
        warningMs: 850
      },
      ui: {
        color: "#f25f4c",
        outlineColor: "#253343",
        pulseColor: "rgba(242,95,76,0.42)",
        minimapSize: 7,
        alertMs: 2400,
        description: "Bursts on death. Back off before it pops."
      }
    },
    bulwarkSquare: {
      id: "bulwarkSquare",
      label: "Bulwark Square",
      shortLabel: "BULWARK",
      shapeType: "square",
      radius: 66,
      hp: 820,
      rewardXp: 1450,
      scoreReward: 1450,
      coinReward: 29,
      durationMs: 95000,
      unlockLevel: 20,
      unlockMatchAgeMs: 160000,
      weight: 0.22,
      threatLevel: 2,
      contactMultiplier: 1.35,
      incomingDamageMultiplier: 0.85,
      botInterestMultiplier: 0.92,
      ui: {
        color: "#3da9fc",
        outlineColor: "#253343",
        pulseColor: "rgba(61,169,252,0.3)",
        minimapSize: 7,
        alertMs: 2200,
        description: "Durable sector objective. High reward, slow clear."
      }
    },
    beaconPentagon: {
      id: "beaconPentagon",
      label: "Beacon Pentagon",
      shortLabel: "BEACON",
      shapeType: "pentagon",
      radius: 60,
      hp: 680,
      rewardXp: 1700,
      scoreReward: 1700,
      coinReward: 34,
      durationMs: 85000,
      unlockLevel: 28,
      unlockMatchAgeMs: 210000,
      weight: 0.11,
      threatLevel: 2,
      contactMultiplier: 1,
      incomingDamageMultiplier: 1,
      botInterestMultiplier: 1.12,
      ui: {
        color: "#ffe75c",
        outlineColor: "#253343",
        pulseColor: "rgba(255,231,92,0.36)",
        minimapSize: 8,
        alertMs: 2600,
        description: "High-value sector objective. Expect company."
      }
    }
  }
};

export const EVENT_OBJECTIVE_CONFIG = deepFreeze(config);

export function getPublicEventObjectiveConfig(content = EVENT_OBJECTIVE_CONFIG) {
  return {
    version: content.version,
    enabled: content.enabled,
    director: {
      firstSpawnMs: content.director.firstSpawnMs,
      firstUnlockLevel: content.director.firstUnlockLevel,
      cooldownMsMin: content.director.cooldownMsMin,
      cooldownMsMax: content.director.cooldownMsMax,
      maxActiveEarly: content.director.maxActiveEarly,
      maxActiveLate: content.director.maxActiveLate,
      lateLevelThreshold: content.director.lateLevelThreshold
    },
    rewards: { ...content.rewards },
    objectives: Object.fromEntries(
      Object.values(content.objectives).map((objective) => [
        objective.id,
        {
          id: objective.id,
          label: objective.label,
          shortLabel: objective.shortLabel,
          shapeType: objective.shapeType,
          radius: objective.radius,
          hp: objective.hp,
          rewardXp: objective.rewardXp,
          coinReward: objective.coinReward,
          durationMs: objective.durationMs,
          threatLevel: objective.threatLevel,
          unlockLevel: objective.unlockLevel,
          unlockMatchAgeMs: objective.unlockMatchAgeMs,
          ui: objective.ui
        }
      ])
    )
  };
}

export function validateEventObjectiveConfig(content = EVENT_OBJECTIVE_CONFIG) {
  const issues = [];
  if (!content.version) {
    issues.push("event objective version is required.");
  }
  if (!content.enabled) {
    return issues;
  }

  const director = content.director ?? {};
  for (const key of [
    "firstSpawnMs",
    "firstUnlockLevel",
    "readinessMatchAgeMs",
    "cooldownMsMin",
    "cooldownMsMax",
    "maxActiveEarly",
    "maxActiveLate",
    "lateLevelThreshold",
    "spawnRadiusMin",
    "spawnRadiusMax",
    "spawnAttempts",
    "playerSafetyRadius",
    "shapeSafetyRadius",
    "retryMs",
    "recentSampleLimit"
  ]) {
    if (!Number.isFinite(director[key]) || director[key] < 0) {
      issues.push(`eventObjectives.director.${key} must be non-negative.`);
    }
  }
  if (director.cooldownMsMin > director.cooldownMsMax) {
    issues.push("event objective min cooldown cannot exceed max cooldown.");
  }
  if (director.spawnRadiusMin > director.spawnRadiusMax) {
    issues.push("event objective min spawn radius cannot exceed max spawn radius.");
  }
  if (director.maxActiveEarly < 1 || director.maxActiveLate < director.maxActiveEarly) {
    issues.push("event objective active caps must be at least one and late cap must not shrink.");
  }

  const rewards = content.rewards ?? {};
  const rewardRatio = (Number(rewards.sharedRewardRatio) || 0) + (Number(rewards.lastHitBonusRatio) || 0);
  if (Math.abs(rewardRatio - 1) > 0.001) {
    issues.push("event objective reward ratios must sum to 1.");
  }
  if (!isRatio(rewards.contributionMinShare)) {
    issues.push("event objective contributionMinShare must be between 0 and 1.");
  }

  const ids = new Set();
  for (const objective of Object.values(content.objectives ?? {})) {
    if (!objective.id || ids.has(objective.id)) {
      issues.push(`invalid or duplicate event objective id: ${objective.id}`);
    }
    ids.add(objective.id);
    for (const key of ["label", "shortLabel", "shapeType"]) {
      if (!objective[key]) {
        issues.push(`event objective ${objective.id} needs ${key}.`);
      }
    }
    for (const key of ["radius", "hp", "rewardXp", "scoreReward", "coinReward", "durationMs", "weight"]) {
      if (!Number.isFinite(objective[key]) || objective[key] <= 0) {
        issues.push(`event objective ${objective.id} has invalid ${key}.`);
      }
    }
    if (!Number.isFinite(objective.unlockLevel) || objective.unlockLevel < 1) {
      issues.push(`event objective ${objective.id} has invalid unlockLevel.`);
    }
    if (!Number.isFinite(objective.unlockMatchAgeMs) || objective.unlockMatchAgeMs < 0) {
      issues.push(`event objective ${objective.id} has invalid unlockMatchAgeMs.`);
    }
    if (!Number.isFinite(objective.threatLevel) || objective.threatLevel < 1 || objective.threatLevel > 5) {
      issues.push(`event objective ${objective.id} threatLevel must be 1..5.`);
    }
    if (!isPositive(objective.contactMultiplier) || !isPositive(objective.incomingDamageMultiplier)) {
      issues.push(`event objective ${objective.id} has invalid damage multipliers.`);
    }
    const xpPerHp = objective.rewardXp / Math.max(1, objective.hp);
    if (xpPerHp < rewards.xpPerHpMin || xpPerHp > rewards.xpPerHpMax) {
      issues.push(`event objective ${objective.id} XP/HP ratio ${xpPerHp.toFixed(2)} is outside configured range.`);
    }
    if (objective.deathBurst?.enabled) {
      for (const key of ["count", "damage", "speed", "ttlMs", "radius", "warningMs"]) {
        if (!Number.isFinite(objective.deathBurst[key]) || objective.deathBurst[key] <= 0) {
          issues.push(`event objective ${objective.id} deathBurst.${key} must be positive.`);
        }
      }
    }
    if (typeof objective.ui?.color !== "string" || typeof objective.ui?.outlineColor !== "string") {
      issues.push(`event objective ${objective.id} needs UI colors.`);
    }
  }
  if (ids.size === 0) {
    issues.push("at least one event objective type is required.");
  }
  return issues;
}

function isPositive(value) {
  return Number.isFinite(value) && value > 0;
}

function isRatio(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}
