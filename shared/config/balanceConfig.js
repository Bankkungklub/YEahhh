const config = {
  leveling: {
    starterUpgradePoints: 3,
    levelMultiplierBands: [
      { minLevel: 1, maxLevel: 14, multiplier: 0.22 },
      { minLevel: 15, maxLevel: 29, multiplier: 0.36 },
      { minLevel: 30, maxLevel: 45, multiplier: 0.55 }
    ]
  },
  rewards: {
    shapes: {
      square: 35,
      triangle: 80,
      pentagon: 220,
      alphaPentagon: 4200
    },
    botKill: {
      base: 260,
      perLevel: 36
    },
    playerKill: {
      base: 340,
      perLevel: 48
    }
  },
  deathPenalty: {
    enabled: true,
    levelMultiplier: 0.5,
    rounding: "ceil",
    minimumLevel: 1,
    resetXpToZero: true,
    scoreMultiplier: 0.5,
    resetUpgradesAndRefundBudget: true,
    applyToKinds: ["player", "bot"]
  }
};

export const BALANCE_CONFIG = deepFreeze(config);

export function getLevelPacingMultiplier(level, balance = BALANCE_CONFIG) {
  const safeLevel = Math.max(1, Math.trunc(Number(level) || 1));
  const band = balance.leveling.levelMultiplierBands.find(
    (candidate) => safeLevel >= candidate.minLevel && safeLevel <= candidate.maxLevel
  );
  return band?.multiplier ?? 1;
}

export function getShapeXpReward(shapeType, balance = BALANCE_CONFIG) {
  const value = balance.rewards.shapes[shapeType];
  return toPositiveInteger(value, 0);
}

export function getTankKillXpReward(victim, balance = BALANCE_CONFIG) {
  const level = Math.max(1, Math.trunc(Number(victim?.level) || 1));
  const reward = victim?.kind === "bot"
    ? balance.rewards.botKill
    : balance.rewards.playerKill;
  return toPositiveInteger(reward.base + level * reward.perLevel, 0);
}

export function validateBalanceConfig(balance = BALANCE_CONFIG) {
  const issues = [];
  if (toPositiveInteger(balance.leveling.starterUpgradePoints, -1) < 0) {
    issues.push("leveling.starterUpgradePoints must be zero or positive.");
  }
  for (const band of balance.leveling.levelMultiplierBands) {
    if (band.minLevel < 1 || band.maxLevel < band.minLevel) {
      issues.push(`Invalid level multiplier band ${band.minLevel}-${band.maxLevel}.`);
    }
    if (!Number.isFinite(band.multiplier) || band.multiplier <= 0 || band.multiplier > 1.5) {
      issues.push(`Invalid multiplier for level band ${band.minLevel}-${band.maxLevel}.`);
    }
  }
  for (const [shapeType, reward] of Object.entries(balance.rewards.shapes)) {
    if (toPositiveInteger(reward, 0) <= 0) {
      issues.push(`Shape XP reward for ${shapeType} must be positive.`);
    }
  }
  for (const key of ["botKill", "playerKill"]) {
    const reward = balance.rewards[key];
    if (toPositiveInteger(reward.base, 0) <= 0 || Number(reward.perLevel) <= 0) {
      issues.push(`${key} reward base and perLevel must be positive.`);
    }
  }
  const penalty = balance.deathPenalty;
  if (!penalty || typeof penalty !== "object") {
    issues.push("deathPenalty config is required.");
  } else {
    if (!Number.isFinite(penalty.levelMultiplier) || penalty.levelMultiplier <= 0 || penalty.levelMultiplier > 1) {
      issues.push("deathPenalty.levelMultiplier must be in the range (0, 1].");
    }
    if (!["ceil", "floor", "round"].includes(penalty.rounding)) {
      issues.push("deathPenalty.rounding must be ceil, floor, or round.");
    }
    if (toPositiveInteger(penalty.minimumLevel, 0) < 1) {
      issues.push("deathPenalty.minimumLevel must be at least 1.");
    }
    if (!Number.isFinite(penalty.scoreMultiplier) || penalty.scoreMultiplier < 0 || penalty.scoreMultiplier > 1) {
      issues.push("deathPenalty.scoreMultiplier must be between 0 and 1.");
    }
    if (!Array.isArray(penalty.applyToKinds) || penalty.applyToKinds.length === 0) {
      issues.push("deathPenalty.applyToKinds must list at least one tank kind.");
    }
  }
  return issues;
}

function toPositiveInteger(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.floor(numeric));
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
