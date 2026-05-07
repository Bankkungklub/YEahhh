import { BALANCE_CONFIG, validateBalanceConfig } from "./balanceConfig.js";
import { getPublicWorldContentConfig, validateWorldContentConfig, WORLD_CONTENT_CONFIG } from "./worldContentConfig.js";

export const UPGRADE_KEYS = [
  "maxHealth",
  "regen",
  "bulletDamage",
  "bulletSpeed",
  "reload",
  "moveSpeed"
];

const config = {
  world: {
    width: 9000,
    height: 9000,
    gridSize: 150,
    spawnSafetyRadius: 650
  },
  server: {
    port: 3000,
    tickRate: 30,
    snapshotRate: 15,
    maxCatchupSteps: 5,
    maxPlayers: 32,
    disconnectGraceMs: 10000,
    respawnDelayMs: 1800
  },
  network: {
    maxMessageBytes: 2048,
    inputRateHz: 30,
    forceInputSendMs: 100,
    changedInputMinIntervalMs: 16,
    interpolationDelayMs: 100
  },
  prediction: {
    enabled: true,
    maxPendingInputs: 90,
    correctionThresholdPx: 8,
    snapThresholdPx: 160,
    correctionMs: 140,
    correctionBlend: 0.32,
    maxFrameDtMs: 50
  },
  tank: {
    radius: 22,
    baseHp: 100,
    baseMoveSpeed: 245,
    maxMoveSpeed: 330,
    spawnInvulnerableMs: 1500,
    regenBaseDelayMs: 6000,
    regenMinDelayMs: 2000,
    regenDelayReductionPerLevelMs: 500,
    regenBasePerSecond: 1,
    regenPerLevelPerSecond: 1.5,
    colors: [
      "#3da9fc",
      "#f25f4c",
      "#2cb67d",
      "#ff8906",
      "#7f5af0",
      "#e53170",
      "#00c2a8",
      "#faae2b"
    ]
  },
  projectile: {
    radius: 6,
    ttlMs: 1400,
    baseSpeed: 680,
    baseDamage: 12,
    baseReloadMs: 430,
    minReloadMs: 140
  },
  upgrades: {
    maxLevel: 7,
    maxPlayerLevel: 60,
    labels: {
      maxHealth: "Max Health",
      regen: "Regen",
      bulletDamage: "Damage",
      bulletSpeed: "Bullet Speed",
      reload: "Reload",
      moveSpeed: "Move Speed"
    }
  },
  xp: {
    base: 60,
    levelScale: 35,
    levelExponent: 1.7,
    shapeRewards: {
      square: BALANCE_CONFIG.rewards.shapes.square,
      triangle: BALANCE_CONFIG.rewards.shapes.triangle,
      pentagon: BALANCE_CONFIG.rewards.shapes.pentagon
    },
    botKillBase: BALANCE_CONFIG.rewards.botKill.base,
    botKillPerLevel: BALANCE_CONFIG.rewards.botKill.perLevel,
    playerKillBase: BALANCE_CONFIG.rewards.playerKill.base,
    playerKillPerLevel: BALANCE_CONFIG.rewards.playerKill.perLevel
  },
  shapes: {
    targetCount: 360,
    spawnAttempts: 36,
    types: {
      square: {
        radius: 24,
        hp: 24,
        xp: BALANCE_CONFIG.rewards.shapes.square,
        sides: 4,
        color: "#faae2b",
        weight: 0.72
      },
      triangle: {
        radius: 28,
        hp: 48,
        xp: BALANCE_CONFIG.rewards.shapes.triangle,
        sides: 3,
        color: "#ef4565",
        weight: 0.22
      },
      pentagon: {
        radius: 38,
        hp: 150,
        xp: BALANCE_CONFIG.rewards.shapes.pentagon,
        sides: 5,
        color: "#3da9fc",
        weight: 0.06
      },
      alphaPentagon: {
        radius: WORLD_CONTENT_CONFIG.centerObjective.radius,
        hp: WORLD_CONTENT_CONFIG.centerObjective.hp,
        xp: WORLD_CONTENT_CONFIG.centerObjective.xp,
        sides: 5,
        color: "#7f5af0",
        weight: 0,
        spawnable: false,
        isCenterObjective: true
      }
    }
  },
  bots: {
    baseCount: 24,
    perHuman: 2.5,
    maxCount: 60,
    aggroRange: 850,
    farmRange: 1100,
    preferredCombatRange: 420,
    retreatHpRatio: 0.3,
    reactionMs: 160,
    wanderRetargetMs: 2600,
    governance: {
      intervalMs: 1000,
      maxLevelNoHumans: 3,
      maxLevelLeadOverHumans: 2,
      maxLevelWithHumans: 8,
      recycleAfterMs: 360000,
      recycleDistanceFromHuman: 1800,
      scoreDecayStartMs: 180000,
      scoreDecayPerMinute: 0.15
    },
    names: [
      "Byte",
      "Vector",
      "Orbit",
      "Patch",
      "Servo",
      "Flux",
      "Nova",
      "Rivet",
      "Quark",
      "Pulse"
    ]
  },
  debug: {
    enabledByQuery: true,
    endpointEnabledInProduction: false,
    includeBotProfiles: true,
    includeSpatialStats: true,
    includeClassCounts: true,
    includeCenterObjective: true,
    includeShapeCounts: true,
    includeBalanceVersion: true
  },
  performance: {
    spatialHashCellSize: 360,
    botQueryRadiusPadding: 80,
    projectileCollisionPadding: 32,
    debugCandidateSamples: 60
  }
};

export const GAME_CONFIG = deepFreeze(config);

export function getTankStats(upgrades = {}, base = GAME_CONFIG) {
  const maxHealthLevel = getUpgradeLevel(upgrades, "maxHealth", base);
  const regenLevel = getUpgradeLevel(upgrades, "regen", base);
  const bulletDamageLevel = getUpgradeLevel(upgrades, "bulletDamage", base);
  const bulletSpeedLevel = getUpgradeLevel(upgrades, "bulletSpeed", base);
  const reloadLevel = getUpgradeLevel(upgrades, "reload", base);
  const moveSpeedLevel = getUpgradeLevel(upgrades, "moveSpeed", base);

  return {
    radius: base.tank.radius,
    maxHp: base.tank.baseHp + maxHealthLevel * 18,
    moveSpeed: Math.min(
      base.tank.maxMoveSpeed,
      base.tank.baseMoveSpeed * (1 + moveSpeedLevel * 0.045)
    ),
    bulletDamage: base.projectile.baseDamage * (1 + bulletDamageLevel * 0.16),
    bulletSpeed: base.projectile.baseSpeed * (1 + bulletSpeedLevel * 0.07),
    projectileRadius: base.projectile.radius,
    projectileTtlMs: base.projectile.ttlMs,
    reloadMs: Math.max(
      base.projectile.minReloadMs,
      base.projectile.baseReloadMs * 0.88 ** reloadLevel
    ),
    regenDelayMs: Math.max(
      base.tank.regenMinDelayMs,
      base.tank.regenBaseDelayMs - regenLevel * base.tank.regenDelayReductionPerLevelMs
    ),
    regenPerSecond: base.tank.regenBasePerSecond + regenLevel * base.tank.regenPerLevelPerSecond
  };
}

export function validateConfig(base = GAME_CONFIG) {
  const issues = [...validateBalanceConfig(), ...validateWorldContentConfig()];

  if (base.world.width <= 0 || base.world.height <= 0) {
    issues.push("World width and height must be positive.");
  }
  if (base.server.tickRate <= 0) {
    issues.push("server.tickRate must be positive.");
  }
  if (base.server.snapshotRate <= 0) {
    issues.push("server.snapshotRate must be positive.");
  }
  if (base.server.snapshotRate > base.server.tickRate) {
    issues.push("server.snapshotRate cannot exceed server.tickRate.");
  }
  if (base.network.inputRateHz <= 0) {
    issues.push("network.inputRateHz must be positive.");
  }
  if (base.network.forceInputSendMs <= 0) {
    issues.push("network.forceInputSendMs must be positive.");
  }
  if (base.prediction.maxPendingInputs < 1) {
    issues.push("prediction.maxPendingInputs must be at least 1.");
  }
  if (base.prediction.correctionBlend <= 0 || base.prediction.correctionBlend > 1) {
    issues.push("prediction.correctionBlend must be in the range (0, 1].");
  }
  if (base.upgrades.maxLevel < 1) {
    issues.push("upgrades.maxLevel must be at least 1.");
  }
  if (base.bots.governance.intervalMs <= 0) {
    issues.push("bots.governance.intervalMs must be positive.");
  }
  if (base.bots.governance.maxLevelNoHumans < 1) {
    issues.push("bots.governance.maxLevelNoHumans must be at least 1.");
  }
  if (base.bots.governance.maxLevelWithHumans < base.bots.governance.maxLevelNoHumans) {
    issues.push("bots.governance.maxLevelWithHumans must be >= maxLevelNoHumans.");
  }
  if (base.bots.governance.recycleDistanceFromHuman <= 0) {
    issues.push("bots.governance.recycleDistanceFromHuman must be positive.");
  }
  if (base.performance.spatialHashCellSize <= 0) {
    issues.push("performance.spatialHashCellSize must be positive.");
  }
  for (const key of UPGRADE_KEYS) {
    if (!base.upgrades.labels[key]) {
      issues.push(`Missing upgrade label for ${key}.`);
    }
  }
  for (const [shapeType, shape] of Object.entries(base.shapes.types)) {
    const spawnable = shape.spawnable !== false;
    if (
      shape.radius <= 0 ||
      shape.hp <= 0 ||
      shape.xp <= 0 ||
      (spawnable && shape.weight <= 0) ||
      (!spawnable && shape.weight < 0)
    ) {
      issues.push(`Invalid shape config for ${shapeType}.`);
    }
  }

  return issues;
}

export function getPublicConfig(base = GAME_CONFIG, extras = {}) {
  return {
    world: base.world,
    tank: {
      radius: base.tank.radius,
      spawnInvulnerableMs: base.tank.spawnInvulnerableMs
    },
    upgrades: base.upgrades,
    network: base.network,
    prediction: base.prediction,
    shapes: base.shapes,
    debug: base.debug,
    worldContent: getPublicWorldContentConfig(),
    ...extras
  };
}

function getUpgradeLevel(upgrades, key, base) {
  const value = Number(upgrades[key] ?? 0);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(base.upgrades.maxLevel, Math.trunc(value)));
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
