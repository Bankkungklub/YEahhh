import { getDroneLoadout } from "../config/droneConfig.js";
import { GAME_CONFIG, UPGRADE_KEYS, getTankStats } from "../config/gameConfig.js";
import {
  getClassAdjustedTankStats,
  getDroneLoadoutId,
  getTankClass
} from "./tankClasses.js";

const PREVIEW_KEYS = new Set(UPGRADE_KEYS);

export function getUpgradePreview({
  localTank = null,
  key,
  config = GAME_CONFIG,
  labels = config.upgrades?.labels ?? {}
} = {}) {
  if (!PREVIEW_KEYS.has(key)) {
    return null;
  }

  const maxLevel = getMaxUpgradeLevel(config);
  const level = clampUpgradeLevel(localTank?.upgrades?.[key], maxLevel);
  const nextLevel = Math.min(maxLevel, level + 1);
  const maxed = level >= maxLevel;
  const classId = localTank?.classId ?? "basic";
  const label = labels[key] ?? config.upgrades?.labels?.[key] ?? key;
  const beforeUpgrades = normalizeUpgrades(localTank?.upgrades, config);
  const afterUpgrades = { ...beforeUpgrades, [key]: nextLevel };
  const beforeStats = getClassStats(beforeUpgrades, classId, config);
  const afterStats = getClassStats(afterUpgrades, classId, config);
  const droneLoadoutId = getDroneLoadoutId(classId);
  const droneLoadout = droneLoadoutId ? getDroneLoadout(droneLoadoutId) : null;

  const preview = buildPreviewForKey({
    key,
    beforeStats,
    afterStats,
    config,
    droneLoadout,
    maxed,
    label
  });

  return {
    key,
    label,
    level,
    maxLevel,
    maxed,
    classId: getTankClass(classId).id,
    droneLoadoutId,
    ...preview
  };
}

export function getUpgradePreviewViewModel({
  localTank = null,
  config = GAME_CONFIG,
  labels = config.upgrades?.labels ?? {}
} = {}) {
  return UPGRADE_KEYS
    .map((key) => getUpgradePreview({ localTank, key, config, labels }))
    .filter(Boolean);
}

function buildPreviewForKey({
  key,
  beforeStats,
  afterStats,
  config,
  droneLoadout,
  maxed,
  label
}) {
  if (maxed) {
    return {
      applies: true,
      valueKind: "maxed",
      summary: "MAX",
      detail: `${label} is already maxed.`
    };
  }

  switch (key) {
    case "maxHealth":
      return {
        applies: true,
        valueKind: "maxHp",
        beforeValue: beforeStats.maxHp,
        afterValue: afterStats.maxHp,
        summary: `HP ${formatWhole(beforeStats.maxHp)} -> ${formatWhole(afterStats.maxHp)}`,
        detail: `Maximum health increases by ${formatWhole(afterStats.maxHp - beforeStats.maxHp)}.`
      };
    case "regen":
      return {
        applies: true,
        valueKind: "regen",
        beforeValue: beforeStats.regenPerSecond,
        afterValue: afterStats.regenPerSecond,
        secondaryBeforeValue: beforeStats.regenDelayMs,
        secondaryAfterValue: afterStats.regenDelayMs,
        summary: `Regen ${formatOne(beforeStats.regenPerSecond)}/s -> ${formatOne(afterStats.regenPerSecond)}/s`,
        detail: `Regen delay ${formatSeconds(beforeStats.regenDelayMs)} -> ${formatSeconds(afterStats.regenDelayMs)}.`
      };
    case "bulletDamage":
      if (droneLoadout) {
        const beforeDamage = getEffectiveDroneDamage(beforeStats, droneLoadout, config);
        const afterDamage = getEffectiveDroneDamage(afterStats, droneLoadout, config);
        return {
          applies: true,
          valueKind: "droneDamage",
          beforeValue: beforeDamage,
          afterValue: afterDamage,
          summary: `Drone DMG ${formatOne(beforeDamage)} -> ${formatOne(afterDamage)}`,
          detail: "Damage upgrades increase command drone contact damage."
        };
      }
      return {
        applies: true,
        valueKind: "bulletDamage",
        beforeValue: beforeStats.bulletDamage,
        afterValue: afterStats.bulletDamage,
        summary: `DMG ${formatOne(beforeStats.bulletDamage)} -> ${formatOne(afterStats.bulletDamage)}`,
        detail: "Projectile damage increases for your current class."
      };
    case "bulletSpeed":
      if (droneLoadout) {
        return {
          applies: false,
          valueKind: "noDirectDroneEffect",
          beforeValue: null,
          afterValue: null,
          summary: "No direct drone effect",
          detail: "This control class commands drones instead of firing bullets."
        };
      }
      return {
        applies: true,
        valueKind: "bulletSpeed",
        beforeValue: beforeStats.bulletSpeed,
        afterValue: afterStats.bulletSpeed,
        summary: `Speed ${formatWhole(beforeStats.bulletSpeed)} -> ${formatWhole(afterStats.bulletSpeed)}`,
        detail: "Projectiles travel faster for your current class."
      };
    case "reload":
      if (droneLoadout) {
        const beforeRebuild = getEffectiveDroneRebuildMs(beforeStats, droneLoadout, config);
        const afterRebuild = getEffectiveDroneRebuildMs(afterStats, droneLoadout, config);
        return {
          applies: true,
          valueKind: "droneRebuildMs",
          beforeValue: beforeRebuild,
          afterValue: afterRebuild,
          summary: `Rebuild ${formatMs(beforeRebuild)} -> ${formatMs(afterRebuild)}`,
          detail: "Reload upgrades rebuild missing base drones faster."
        };
      }
      return {
        applies: true,
        valueKind: "reloadMs",
        beforeValue: beforeStats.reloadMs,
        afterValue: afterStats.reloadMs,
        summary: `Reload ${formatMs(beforeStats.reloadMs)} -> ${formatMs(afterStats.reloadMs)}`,
        detail: "Lower reload time means faster firing."
      };
    case "moveSpeed":
      return {
        applies: true,
        valueKind: "moveSpeed",
        beforeValue: beforeStats.moveSpeed,
        afterValue: afterStats.moveSpeed,
        summary: `Move ${formatWhole(beforeStats.moveSpeed)} -> ${formatWhole(afterStats.moveSpeed)}`,
        detail: "Movement speed increases for your current class."
      };
    default:
      return {
        applies: true,
        valueKind: "unknown",
        summary: "",
        detail: ""
      };
  }
}

function getClassStats(upgrades, classId, config) {
  return getClassAdjustedTankStats(getTankStats(upgrades, config), classId);
}

function getEffectiveDroneDamage(stats, loadout, config) {
  const baseDamage = config.projectile?.baseDamage ?? GAME_CONFIG.projectile.baseDamage;
  const damageMultiplier = Math.max(0.25, (stats.bulletDamage ?? baseDamage) / baseDamage);
  return loadout.bodyDamage * damageMultiplier;
}

function getEffectiveDroneRebuildMs(stats, loadout, config) {
  const baseReload = config.projectile?.baseReloadMs ?? GAME_CONFIG.projectile.baseReloadMs;
  const reloadMultiplier = clamp(baseReload / Math.max(1, stats.reloadMs), 0.75, 1.35);
  return Math.max(120, loadout.rebuildMs / reloadMultiplier);
}

function normalizeUpgrades(upgrades = {}, config) {
  const normalized = {};
  const maxLevel = getMaxUpgradeLevel(config);
  for (const key of UPGRADE_KEYS) {
    normalized[key] = clampUpgradeLevel(upgrades[key], maxLevel);
  }
  return normalized;
}

function getMaxUpgradeLevel(config) {
  const value = Number(config.upgrades?.maxLevel ?? GAME_CONFIG.upgrades.maxLevel);
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : GAME_CONFIG.upgrades.maxLevel;
}

function clampUpgradeLevel(value, maxLevel) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(maxLevel, Math.trunc(number)));
}

function formatWhole(value) {
  return String(Math.round(Number(value) || 0));
}

function formatOne(value) {
  const rounded = Math.round((Number(value) || 0) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatMs(value) {
  return `${Math.round(Number(value) || 0)}ms`;
}

function formatSeconds(value) {
  return `${formatOne((Number(value) || 0) / 1000)}s`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
