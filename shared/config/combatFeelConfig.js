export const COMBAT_FEEL_CONFIG = deepFreeze({
  recoil: {
    enabled: true,
    directional: true,
    localPrediction: true,
    baseImpulse: 34,
    maxRecoilSpeed: 160,
    decayPerSecond: 8,
    heavyClassMultiplier: 1.35,
    trapClassMultiplier: 0.65,
    multiShotNormalization: "sqrt",
    kindMultiplier: {
      bullet: 1,
      rocket: 1.25,
      spark: 0.25,
      trap: 0.45
    }
  },
  muzzle: {
    flashMs: 90,
    barrelKickPx: 7,
    spawnExtraPx: 4
  },
  projectileVisuals: {
    bullet: {
      trailMs: 120,
      trailWidth: 1.2,
      trailAlpha: 0.62,
      fill: "#ffe75c",
      core: "#fff9b0",
      trail: "rgba(37,51,67,0.32)",
      outlineColor: "#253343",
      outlineWidth: 3,
      pulseColor: "rgba(255,231,92,0.28)",
      warningRing: "none",
      impactStyle: "ring"
    },
    rocket: {
      trailMs: 240,
      trailWidth: 2.3,
      trailAlpha: 0.78,
      fill: "#ff8c42",
      core: "#fff1a8",
      trail: "rgba(255,140,66,0.54)",
      outlineColor: "#253343",
      outlineWidth: 4.4,
      pulseColor: "rgba(255,140,66,0.34)",
      warningRing: "none",
      impactStyle: "shockwave"
    },
    spark: {
      trailMs: 90,
      trailWidth: 0.9,
      trailAlpha: 0.55,
      fill: "#f25f4c",
      core: "#ffe75c",
      trail: "rgba(242,95,76,0.36)",
      outlineColor: "#253343",
      outlineWidth: 2.4,
      pulseColor: "rgba(242,95,76,0.25)",
      warningRing: "none",
      impactStyle: "shards"
    },
    trap: {
      trailMs: 0,
      trailWidth: 0,
      trailAlpha: 0,
      fill: "#7f5af0",
      core: "#d6bcfa",
      trail: "rgba(127,90,240,0)",
      outlineColor: "#253343",
      outlineWidth: 3.6,
      pulseColor: "rgba(214,188,250,0.45)",
      warningRing: "armed",
      impactStyle: "burst",
      pulseMs: 900
    }
  },
  projectileBehaviors: {
    rocket: {
      sparkCount: 6,
      sparkDamageMultiplier: 0.28,
      sparkSpeedMultiplier: 0.82,
      sparkTtlMs: 420,
      explosionRadius: 130,
      ownerGraceMs: 250
    },
    starburst: {
      sparkCount: 10,
      sparkDamageMultiplier: 0.22,
      sparkSpeedMultiplier: 0.86,
      sparkTtlMs: 460,
      explosionRadius: 150,
      ownerGraceMs: 250
    },
    missile: {
      sparkCount: 8,
      sparkDamageMultiplier: 0.2,
      sparkSpeedMultiplier: 0.84,
      sparkTtlMs: 430,
      explosionRadius: 145,
      ownerGraceMs: 250,
      turnRateRadPerSec: 1.65,
      targetAcquireRange: 680,
      targetConeRadians: 0.9,
      maxSteerMs: 850
    },
    trap: {
      armMs: 250,
      stopAfterMs: 250,
      ttlMs: 8500,
      maxHits: 3,
      damageMultiplier: 0.9,
      hitCooldownMs: 450,
      blocksProjectiles: true,
      blockableKinds: ["bullet", "spark", "rocket"],
      blockConsumesHit: true
    }
  },
  contactCollision: {
    enabled: true,
    maxPairsPerTick: 420,
    shapePushStrength: 0.72,
    tankPushStrength: 0.52,
    minImpactSpeed: 80,
    baseTankBodyDps: 22,
    baseShapeBodyDps: 18,
    speedDamageScale: 0.018,
    alphaDamageMultiplier: 0.45,
    spawnInvulnerableDealsDamage: false,
    spawnInvulnerableTakesDamage: false
  }
});

export function getProjectileVisual(kind, config = COMBAT_FEEL_CONFIG) {
  const fallback = config.projectileVisuals.bullet;
  return {
    ...fallback,
    ...(config.projectileVisuals[kind] ?? fallback)
  };
}

export function validateCombatFeelConfig(config = COMBAT_FEEL_CONFIG) {
  const issues = [];
  for (const key of ["baseImpulse", "maxRecoilSpeed", "decayPerSecond"]) {
    if (!isPositive(config.recoil?.[key])) {
      issues.push(`combatFeel.recoil.${key} must be positive.`);
    }
  }
  if (!["none", "sqrt"].includes(config.recoil?.multiShotNormalization)) {
    issues.push("combatFeel.recoil.multiShotNormalization must be none or sqrt.");
  }
  for (const [kind, multiplier] of Object.entries(config.recoil?.kindMultiplier ?? {})) {
    if (!isPositive(multiplier)) {
      issues.push(`combatFeel.recoil.kindMultiplier.${kind} must be positive.`);
    }
  }
  for (const key of ["flashMs", "barrelKickPx", "spawnExtraPx"]) {
    if (!isNonNegative(config.muzzle?.[key])) {
      issues.push(`combatFeel.muzzle.${key} must be non-negative.`);
    }
  }
  for (const [kind, visual] of Object.entries(config.projectileVisuals ?? {})) {
    if (!isNonNegative(visual.trailMs) || !isNonNegative(visual.trailWidth)) {
      issues.push(`combatFeel.projectileVisuals.${kind} has invalid trail values.`);
    }
    if (!isRatio(visual.trailAlpha)) {
      issues.push(`combatFeel.projectileVisuals.${kind}.trailAlpha must be 0..1.`);
    }
    if (typeof visual.fill !== "string" || typeof visual.core !== "string") {
      issues.push(`combatFeel.projectileVisuals.${kind} needs fill/core colors.`);
    }
    if (typeof visual.outlineColor !== "string" || !isNonNegative(visual.outlineWidth)) {
      issues.push(`combatFeel.projectileVisuals.${kind} needs outline color/width.`);
    }
    if (typeof visual.pulseColor !== "string") {
      issues.push(`combatFeel.projectileVisuals.${kind}.pulseColor must be a color string.`);
    }
    if (!["none", "armed", "always"].includes(visual.warningRing)) {
      issues.push(`combatFeel.projectileVisuals.${kind}.warningRing must be none, armed, or always.`);
    }
    if (!["ring", "burst", "shards", "shockwave"].includes(visual.impactStyle)) {
      issues.push(`combatFeel.projectileVisuals.${kind}.impactStyle is invalid.`);
    }
  }
  for (const key of ["rocket", "starburst", "missile"]) {
    const behavior = config.projectileBehaviors?.[key];
    if (!Number.isInteger(behavior?.sparkCount) || behavior.sparkCount <= 0 || behavior.sparkCount > 16) {
      issues.push(`combatFeel.projectileBehaviors.${key}.sparkCount must be 1..16.`);
    }
    for (const field of ["sparkDamageMultiplier", "sparkSpeedMultiplier", "sparkTtlMs", "explosionRadius"]) {
      if (!isPositive(behavior?.[field])) {
        issues.push(`combatFeel.projectileBehaviors.${key}.${field} must be positive.`);
      }
    }
    if (key === "missile") {
      for (const field of ["turnRateRadPerSec", "targetAcquireRange", "targetConeRadians", "maxSteerMs"]) {
        if (!isPositive(behavior?.[field])) {
          issues.push(`combatFeel.projectileBehaviors.missile.${field} must be positive.`);
        }
      }
      if (behavior?.targetConeRadians > Math.PI) {
        issues.push("combatFeel.projectileBehaviors.missile.targetConeRadians must be <= PI.");
      }
    }
  }
  const trap = config.projectileBehaviors?.trap;
  for (const field of ["armMs", "stopAfterMs", "ttlMs", "maxHits", "damageMultiplier", "hitCooldownMs"]) {
    if (!isPositive(trap?.[field])) {
      issues.push(`combatFeel.projectileBehaviors.trap.${field} must be positive.`);
    }
  }
  if (typeof trap?.blocksProjectiles !== "boolean") {
    issues.push("combatFeel.projectileBehaviors.trap.blocksProjectiles must be boolean.");
  }
  if (typeof trap?.blockConsumesHit !== "boolean") {
    issues.push("combatFeel.projectileBehaviors.trap.blockConsumesHit must be boolean.");
  }
  const knownProjectileKinds = new Set(["bullet", "spark", "rocket", "trap"]);
  if (!Array.isArray(trap?.blockableKinds) || trap.blockableKinds.length === 0) {
    issues.push("combatFeel.projectileBehaviors.trap.blockableKinds must be a non-empty array.");
  } else {
    for (const kind of trap.blockableKinds) {
      if (!knownProjectileKinds.has(kind)) {
        issues.push(`combatFeel.projectileBehaviors.trap.blockableKinds contains unknown kind ${kind}.`);
      }
    }
  }
  for (const field of ["maxPairsPerTick", "shapePushStrength", "tankPushStrength", "baseTankBodyDps", "baseShapeBodyDps"]) {
    if (!isPositive(config.contactCollision?.[field])) {
      issues.push(`combatFeel.contactCollision.${field} must be positive.`);
    }
  }
  return issues;
}

function isPositive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function isNonNegative(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0;
}

function isRatio(value) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 1;
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
