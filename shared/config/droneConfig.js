const LOADOUT_IDS = ["overseer", "overlord", "necromancer", "hiveLord"];

const config = {
  enabled: true,
  globalDroneCap: 180,
  maxContactPairsPerTick: 260,
  projectileVsDroneMultiplier: 1,
  ownerInvulnerabilityDisablesDamage: true,
  noRewardOnDroneKill: true,
  debug: {
    includeDrones: true,
    recentSamples: 8
  },
  balance: {
    uptimeFactors: {
      overseer: 0.45,
      overlord: 0.45,
      necromancer: 0.35,
      hiveLord: 0.32
    },
    effectiveDpsMin: 12,
    effectiveDpsMax: 72
  },
  render: {
    commandLineColor: "rgba(255,255,255,0.34)",
    localOutlineColor: "#ffffff",
    enemyOutlineColor: "rgba(37,51,67,0.88)"
  },
  loadouts: {
    overseer: loadout({
      id: "overseer",
      label: "DRONES",
      classIds: ["overseer"],
      baseDrones: 2,
      maxDrones: 2,
      radius: 12,
      maxHp: 26,
      bodyDamage: 9,
      moveSpeed: 360,
      turnRate: 8.5,
      rebuildMs: 1800,
      attackRange: 760,
      commandDistance: 760,
      commandSpread: 0.32,
      leashDistance: 1100,
      orbitRadius: 92,
      orbitAngularSpeed: 1.55,
      hitCooldownMs: 360,
      render: {
        bodyColor: "#b8f28e",
        outlineColor: "#253343"
      }
    }),
    overlord: loadout({
      id: "overlord",
      label: "DRONES",
      classIds: ["overlord"],
      baseDrones: 4,
      maxDrones: 4,
      radius: 13,
      maxHp: 30,
      bodyDamage: 10,
      moveSpeed: 380,
      turnRate: 8.8,
      rebuildMs: 1650,
      attackRange: 850,
      commandDistance: 850,
      commandSpread: 0.42,
      leashDistance: 1200,
      orbitRadius: 105,
      orbitAngularSpeed: 1.45,
      hitCooldownMs: 360,
      render: {
        bodyColor: "#8de8e2",
        outlineColor: "#253343"
      }
    }),
    necromancer: loadout({
      id: "necromancer",
      label: "SWARM",
      classIds: ["necromancer"],
      baseDrones: 4,
      maxDrones: 8,
      radius: 10,
      maxHp: 18,
      bodyDamage: 7,
      moveSpeed: 330,
      turnRate: 8,
      rebuildMs: 2200,
      attackRange: 780,
      commandDistance: 780,
      commandSpread: 0.55,
      leashDistance: 1100,
      orbitRadius: 115,
      orbitAngularSpeed: 1.7,
      hitCooldownMs: 380,
      convertedDroneTtlMs: 18000,
      conversionRules: {
        square: { chance: 0.35, count: 1 },
        triangle: { chance: 0.65, count: 1 },
        pentagon: { chance: 1, count: 2 }
      },
      render: {
        bodyColor: "#b8f28e",
        outlineColor: "#473069",
        convertedBodyColor: "#d6bcfa"
      }
    }),
    hiveLord: loadout({
      id: "hiveLord",
      label: "SWARM",
      classIds: ["hiveLord"],
      baseDrones: 5,
      maxDrones: 10,
      radius: 10,
      maxHp: 18,
      bodyDamage: 7.5,
      moveSpeed: 335,
      turnRate: 7.6,
      rebuildMs: 2400,
      attackRange: 820,
      commandDistance: 820,
      commandSpread: 0.68,
      leashDistance: 1220,
      orbitRadius: 84,
      orbitAngularSpeed: 1.45,
      hitCooldownMs: 380,
      convertedDroneTtlMs: 16000,
      conversionRules: {
        square: { chance: 0.38, count: 1 },
        triangle: { chance: 0.68, count: 1 },
        pentagon: { chance: 1, count: 2 }
      },
      render: {
        bodyColor: "#f6d365",
        outlineColor: "#473069",
        convertedBodyColor: "#ffd6a5"
      }
    })
  }
};

export const DRONE_CONFIG = deepFreeze(config);

export function validateDroneConfig(base = DRONE_CONFIG) {
  const issues = [];
  if (base.enabled !== true) {
    issues.push("Drone config must be enabled for control branch loadouts.");
  }
  if (!Number.isFinite(Number(base.globalDroneCap)) || Number(base.globalDroneCap) < 1 || Number(base.globalDroneCap) > 240) {
    issues.push("Drone global cap must be in 1..240.");
  }
  if (!Number.isFinite(Number(base.projectileVsDroneMultiplier)) || Number(base.projectileVsDroneMultiplier) <= 0) {
    issues.push("Drone projectile damage multiplier must be positive.");
  }
  if (!Number.isFinite(Number(base.maxContactPairsPerTick)) || Number(base.maxContactPairsPerTick) < 1) {
    issues.push("Drone maxContactPairsPerTick must be positive.");
  }
  for (const id of LOADOUT_IDS) {
    if (!base.loadouts?.[id]) {
      issues.push(`Missing drone loadout ${id}.`);
    }
  }
  for (const [id, loadoutConfig] of Object.entries(base.loadouts ?? {})) {
    if (id !== loadoutConfig.id) {
      issues.push(`Drone loadout key ${id} must match id ${loadoutConfig.id}.`);
    }
    for (const key of [
      "baseDrones",
      "maxDrones",
      "radius",
      "maxHp",
      "bodyDamage",
      "moveSpeed",
      "turnRate",
      "rebuildMs",
      "attackRange",
      "commandDistance",
      "commandSpread",
      "leashDistance",
      "orbitRadius",
      "orbitAngularSpeed",
      "hitCooldownMs"
    ]) {
      const value = loadoutConfig[key];
      if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
        issues.push(`Drone loadout ${id} has invalid ${key}.`);
      }
    }
    if (loadoutConfig.baseDrones > loadoutConfig.maxDrones) {
      issues.push(`Drone loadout ${id} baseDrones cannot exceed maxDrones.`);
    }
    if (loadoutConfig.maxDrones > 10) {
      issues.push(`Drone loadout ${id} exceeds per-owner cap 10.`);
    }
    if (!Array.isArray(loadoutConfig.classIds) || loadoutConfig.classIds.length === 0) {
      issues.push(`Drone loadout ${id} must list classIds.`);
    }
    if (loadoutConfig.convertedDroneTtlMs !== null && (!Number.isFinite(Number(loadoutConfig.convertedDroneTtlMs)) || Number(loadoutConfig.convertedDroneTtlMs) <= 0)) {
      issues.push(`Drone loadout ${id} has invalid convertedDroneTtlMs.`);
    }
    for (const [shapeType, rule] of Object.entries(loadoutConfig.conversionRules ?? {})) {
      if (!["square", "triangle", "pentagon"].includes(shapeType)) {
        issues.push(`Drone loadout ${id} has unsupported conversion shape ${shapeType}.`);
      }
      if (!Number.isFinite(Number(rule.chance)) || rule.chance < 0 || rule.chance > 1) {
        issues.push(`Drone loadout ${id} conversion ${shapeType} chance must be 0..1.`);
      }
      if (!Number.isFinite(Number(rule.count)) || rule.count < 1 || rule.count > 3) {
        issues.push(`Drone loadout ${id} conversion ${shapeType} count must be 1..3.`);
      }
    }
  }
  return issues;
}

export function getDroneLoadout(loadoutId, base = DRONE_CONFIG) {
  return base.loadouts?.[loadoutId] ?? null;
}

export function getPublicDroneConfig(base = DRONE_CONFIG) {
  return {
    enabled: base.enabled,
    globalDroneCap: base.globalDroneCap,
    render: base.render,
    loadouts: Object.fromEntries(
      Object.entries(base.loadouts).map(([id, loadoutConfig]) => [
        id,
        {
          id: loadoutConfig.id,
          label: loadoutConfig.label,
          classIds: loadoutConfig.classIds,
          baseDrones: loadoutConfig.baseDrones,
          maxDrones: loadoutConfig.maxDrones,
          radius: loadoutConfig.radius,
          maxHp: loadoutConfig.maxHp,
          bodyDamage: loadoutConfig.bodyDamage,
          rebuildMs: loadoutConfig.rebuildMs,
          attackRange: loadoutConfig.attackRange,
          commandDistance: loadoutConfig.commandDistance,
          render: loadoutConfig.render
        }
      ])
    )
  };
}

function loadout(values) {
  return {
    conversionRules: {},
    convertedDroneTtlMs: null,
    ...values
  };
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
