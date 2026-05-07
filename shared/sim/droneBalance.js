import { DRONE_CONFIG, getDroneLoadout, validateDroneConfig } from "../config/droneConfig.js";
import { GAME_CONFIG, getTankStats } from "../config/gameConfig.js";
import { TANK_CLASS_CONFIG } from "../config/tankClassConfig.js";
import { getClassAdjustedTankStats } from "./tankClasses.js";

const EPSILON = 0.0001;

export function getDroneBalanceSummary(classId, {
  droneConfig = DRONE_CONFIG,
  tankConfig = TANK_CLASS_CONFIG,
  gameConfig = GAME_CONFIG
} = {}) {
  const tankClass = tankConfig.classes[classId];
  const loadout = tankClass?.droneLoadoutId ? getDroneLoadout(tankClass.droneLoadoutId, droneConfig) : null;
  if (!tankClass || !loadout) {
    return null;
  }
  const stats = getClassAdjustedTankStats(getTankStats({}, gameConfig), classId, tankConfig);
  const reloadMultiplier = getReloadMultiplier(stats, gameConfig);
  const effectiveRebuildMs = Math.max(120, loadout.rebuildMs / reloadMultiplier);
  const uptimeFactor = droneConfig.balance?.uptimeFactors?.[loadout.id] ?? 0.4;
  const rawDps = loadout.maxDrones * loadout.bodyDamage / Math.max(EPSILON, loadout.hitCooldownMs / 1000);
  const effectiveDps = rawDps * uptimeFactor;
  return {
    classId,
    loadoutId: loadout.id,
    label: loadout.label,
    baseDrones: loadout.baseDrones,
    maxDrones: loadout.maxDrones,
    droneHp: loadout.maxHp,
    bodyDamage: loadout.bodyDamage,
    hitCooldownMs: loadout.hitCooldownMs,
    rebuildMs: loadout.rebuildMs,
    effectiveRebuildMs,
    rawDps,
    effectiveDps,
    uptimeFactor,
    rebuildPressure: (loadout.maxDrones * loadout.maxHp) / Math.max(1, effectiveRebuildMs)
  };
}

export function getAllDroneBalanceSummaries(options = {}) {
  const tankConfig = options.tankConfig ?? TANK_CLASS_CONFIG;
  return Object.fromEntries(
    Object.keys(tankConfig.classes)
      .map((classId) => [classId, getDroneBalanceSummary(classId, options)])
      .filter(([, summary]) => Boolean(summary))
  );
}

export function validateDroneBalance({
  droneConfig = DRONE_CONFIG,
  tankConfig = TANK_CLASS_CONFIG,
  gameConfig = GAME_CONFIG
} = {}) {
  const issues = [...validateDroneConfig(droneConfig)];
  const min = droneConfig.balance?.effectiveDpsMin ?? 0;
  const max = droneConfig.balance?.effectiveDpsMax ?? Infinity;
  for (const [classId, tankClass] of Object.entries(tankConfig.classes ?? {})) {
    if (!tankClass.droneLoadoutId) {
      continue;
    }
    const summary = getDroneBalanceSummary(classId, { droneConfig, tankConfig, gameConfig });
    if (!summary) {
      issues.push(`${classId} references missing drone loadout ${tankClass.droneLoadoutId}.`);
      continue;
    }
    if (!Number.isFinite(summary.effectiveDps) || summary.effectiveDps < min || summary.effectiveDps > max) {
      issues.push(`${classId} drone effective DPS ${round(summary.effectiveDps)} is outside ${min}..${max}.`);
    }
    if (!Number.isFinite(summary.effectiveRebuildMs) || summary.effectiveRebuildMs < 120) {
      issues.push(`${classId} drone rebuild is invalid.`);
    }
  }
  return issues;
}

function getReloadMultiplier(stats, gameConfig) {
  const base = gameConfig.projectile.baseReloadMs;
  const reloadMs = Math.max(1, stats.reloadMs ?? base);
  return Math.max(0.75, Math.min(1.35, base / reloadMs));
}

function round(value) {
  return Math.round(Number(value) * 100) / 100;
}
