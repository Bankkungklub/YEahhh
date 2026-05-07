import { BALANCE_CONFIG, getLevelPacingMultiplier, getShapeXpReward, getTankKillXpReward } from "../config/balanceConfig.js";
import { GAME_CONFIG, UPGRADE_KEYS } from "../config/gameConfig.js";

export function createProgression() {
  const upgrades = {};
  for (const key of UPGRADE_KEYS) {
    upgrades[key] = 0;
  }

  return {
    level: 1,
    xp: 0,
    score: 0,
    upgradePoints: BALANCE_CONFIG.leveling.starterUpgradePoints,
    upgrades
  };
}

export function xpForNextLevel(level, config = GAME_CONFIG) {
  const safeLevel = Math.max(1, Math.trunc(Number(level) || 1));
  const baseXp = Math.floor(config.xp.base + config.xp.levelScale * safeLevel ** config.xp.levelExponent);
  return Math.max(1, Math.floor(baseXp * getLevelPacingMultiplier(safeLevel)));
}

export function addXp(progress, amount, scoreAmount = amount, config = GAME_CONFIG) {
  const safeAmount = Math.max(0, Number(amount) || 0);
  const safeScore = Math.max(0, Number(scoreAmount) || 0);
  let levelsGained = 0;
  let awardedPoints = 0;

  progress.xp += safeAmount;
  progress.score += safeScore;

  while (
    progress.level < config.upgrades.maxPlayerLevel &&
    progress.xp >= xpForNextLevel(progress.level, config)
  ) {
    progress.xp -= xpForNextLevel(progress.level, config);
    progress.level += 1;
    levelsGained += 1;

    const points = upgradePointsForLevel(progress.level);
    progress.upgradePoints += points;
    awardedPoints += points;
  }

  if (progress.level >= config.upgrades.maxPlayerLevel) {
    progress.xp = Math.min(progress.xp, xpForNextLevel(config.upgrades.maxPlayerLevel, config) - 1);
  }

  return { levelsGained, awardedPoints };
}

export function upgradePointsForLevel(level) {
  if (level >= 2 && level <= 28) {
    return 1;
  }
  if (level > 28 && level % 3 === 0) {
    return 1;
  }
  return 0;
}

export function getTotalUpgradeBudgetForLevel(level) {
  const safeLevel = Math.max(1, Math.trunc(Number(level) || 1));
  let total = BALANCE_CONFIG.leveling.starterUpgradePoints;
  for (let current = 2; current <= safeLevel; current += 1) {
    total += upgradePointsForLevel(current);
  }
  return total;
}

export function getDeathPenaltyLevel(oldLevel, balance = BALANCE_CONFIG) {
  const penalty = balance.deathPenalty;
  const safeLevel = Math.max(1, Math.trunc(Number(oldLevel) || 1));
  const rawLevel = safeLevel * penalty.levelMultiplier;
  const rounded = penalty.rounding === "floor"
    ? Math.floor(rawLevel)
    : penalty.rounding === "round"
      ? Math.round(rawLevel)
      : Math.ceil(rawLevel);
  return Math.max(penalty.minimumLevel, rounded);
}

export function applyDeathProgressionPenalty(progress, balance = BALANCE_CONFIG) {
  const penalty = balance.deathPenalty;
  if (!penalty.enabled || !penalty.applyToKinds.includes(progress.kind ?? "player")) {
    return {
      applied: false,
      oldLevel: progress.level,
      newLevel: progress.level,
      oldScore: Math.floor(progress.score ?? 0),
      newScore: Math.floor(progress.score ?? 0),
      scoreLost: 0
    };
  }

  const oldLevel = Math.max(1, Math.trunc(Number(progress.level) || 1));
  const oldXp = Math.max(0, Math.floor(Number(progress.xp) || 0));
  const oldScore = Math.max(0, Math.floor(Number(progress.score) || 0));
  const oldUpgradePoints = Math.max(0, Math.floor(Number(progress.upgradePoints) || 0));
  const oldUpgrades = cloneUpgrades(progress.upgrades);
  const newLevel = getDeathPenaltyLevel(oldLevel, balance);
  const newScore = Math.max(0, Math.floor(oldScore * penalty.scoreMultiplier));

  progress.level = newLevel;
  progress.xp = penalty.resetXpToZero ? 0 : Math.min(oldXp, xpForNextLevel(newLevel) - 1);
  progress.score = newScore;

  if (penalty.resetUpgradesAndRefundBudget) {
    for (const key of UPGRADE_KEYS) {
      progress.upgrades[key] = 0;
    }
    progress.upgradePoints = getTotalUpgradeBudgetForLevel(newLevel);
  } else {
    progress.upgradePoints = oldUpgradePoints;
  }

  return {
    applied: true,
    oldLevel,
    newLevel,
    oldXp,
    newXp: Math.floor(progress.xp),
    oldScore,
    newScore,
    scoreLost: oldScore - newScore,
    oldUpgradePoints,
    newUpgradePoints: progress.upgradePoints,
    oldUpgrades,
    newUpgrades: cloneUpgrades(progress.upgrades)
  };
}

export function canUpgrade(progress, key, config = GAME_CONFIG) {
  return (
    UPGRADE_KEYS.includes(key) &&
    progress.upgradePoints > 0 &&
    progress.upgrades[key] < config.upgrades.maxLevel
  );
}

export function applyUpgrade(progress, key, config = GAME_CONFIG) {
  if (!canUpgrade(progress, key, config)) {
    return false;
  }

  progress.upgrades[key] += 1;
  progress.upgradePoints -= 1;
  return true;
}

export function xpRewardForTankKill(victim, config = GAME_CONFIG) {
  return getTankKillXpReward(victim);
}

export function xpForShape(shapeType) {
  return getShapeXpReward(shapeType);
}

function cloneUpgrades(upgrades = {}) {
  const clone = {};
  for (const key of UPGRADE_KEYS) {
    clone[key] = Math.max(0, Math.trunc(Number(upgrades[key]) || 0));
  }
  return clone;
}
