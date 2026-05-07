import { GAME_CONFIG, getTankStats } from "../config/gameConfig.js";
import { DRONE_CONFIG, getDroneLoadout } from "../config/droneConfig.js";
import { TANK_CLASS_CONFIG } from "../config/tankClassConfig.js";
import { getClassAdjustedTankStats, getWeaponPattern } from "./tankClasses.js";

const FORWARD_ARC_RADIANS = 0.55;
const EPSILON = 0.0001;

export function calculateClassDps(classId, baseStats = getTankStats({}, GAME_CONFIG), config = TANK_CLASS_CONFIG) {
  const tankClass = config.classes[classId] ?? config.classes[config.defaultClassId];
  const stats = getClassAdjustedTankStats(baseStats, tankClass.id, config);
  const pattern = getWeaponPattern(tankClass.id, config);
  const reloadSeconds = Math.max(EPSILON, stats.reloadMs / 1000);
  const totalShotDamage = pattern.reduce((sum, shot) => sum + getShotDamage(stats, shot), 0);
  const forwardShotDamage = pattern.reduce((sum, shot) => {
    return isForwardShot(shot) ? sum + getShotDamage(stats, shot) : sum;
  }, 0);
  const maxProjectileDamage = pattern.reduce((max, shot) => Math.max(max, getShotDamage(stats, shot)), 0);
  const drone = getClassDroneDps(tankClass, stats);
  const projectileCount = Math.max(pattern.length, drone?.maxDrones ?? 0);
  const totalDps = totalShotDamage / reloadSeconds + (drone?.effectiveDps ?? 0);
  const focusedDps = forwardShotDamage / reloadSeconds + (drone ? drone.effectiveDps * 0.8 : 0);

  return {
    classId: tankClass.id,
    role: tankClass.balanceRole,
    projectileCount,
    totalShotDamage,
    forwardShotDamage,
    droneDps: drone?.effectiveDps ?? 0,
    totalDps,
    focusedDps,
    mobilityScore: safeRatio(stats.moveSpeed, baseStats.moveSpeed),
    survivabilityScore: safeRatio(stats.maxHp * (stats.bodyResistance ?? 1), baseStats.maxHp),
    burstScore: safeRatio(Math.max(maxProjectileDamage, drone?.bodyDamage ?? 0), baseStats.bulletDamage),
    reloadMs: stats.reloadMs
  };
}

export function getClassBalanceRole(classId, config = TANK_CLASS_CONFIG) {
  const tankClass = config.classes[classId] ?? config.classes[config.defaultClassId];
  return tankClass.balanceRole ?? "sustain";
}

export function getClassBalanceSummary(config = TANK_CLASS_CONFIG, base = GAME_CONFIG) {
  const baseStats = getTankStats({}, base);
  const basicDps = calculateClassDps(config.defaultClassId, baseStats, config);
  const basicTotalDps = Math.max(EPSILON, basicDps.totalDps);
  const basicFocusedDps = Math.max(EPSILON, basicDps.focusedDps);

  return Object.fromEntries(
    Object.keys(config.classes).map((classId) => {
      const dps = calculateClassDps(classId, baseStats, config);
      return [
        classId,
        {
          ...dps,
          totalDpsRatio: dps.totalDps / basicTotalDps,
          focusedDpsRatio: dps.focusedDps / basicFocusedDps,
          visualSignature: getClassVisualSignature(classId, config)
        }
      ];
    })
  );
}

export function validateClassBalanceBudgets(config = TANK_CLASS_CONFIG, base = GAME_CONFIG) {
  const issues = [];
  const summary = getClassBalanceSummary(config, base);

  for (const [classId, entry] of Object.entries(summary)) {
    const tankClass = config.classes[classId];
    const budget = tankClass.balanceBudget;
    if (!Number.isFinite(entry.totalDps) || !Number.isFinite(entry.focusedDps)) {
      issues.push(`${classId} has non-finite DPS.`);
      continue;
    }
    const maxOffensiveEntities = tankClass.droneLoadoutId ? 10 : 8;
    if (entry.projectileCount < 1 || entry.projectileCount > maxOffensiveEntities) {
      issues.push(`${classId} offensive entity count ${entry.projectileCount} is outside 1..${maxOffensiveEntities}.`);
    }
    if (entry.focusedDpsRatio < budget.focusedDpsMin || entry.focusedDpsRatio > budget.focusedDpsMax) {
      issues.push(`${classId} focused DPS ratio ${round(entry.focusedDpsRatio)} is outside ${budget.focusedDpsMin}..${budget.focusedDpsMax}.`);
    }
    if (entry.totalDpsRatio < budget.totalDpsMin || entry.totalDpsRatio > budget.totalDpsMax) {
      issues.push(`${classId} total DPS ratio ${round(entry.totalDpsRatio)} is outside ${budget.totalDpsMin}..${budget.totalDpsMax}.`);
    }
  }

  return issues;
}

function getClassDroneDps(tankClass, stats) {
  if (!tankClass?.droneLoadoutId) {
    return null;
  }
  const loadout = getDroneLoadout(tankClass.droneLoadoutId);
  if (!loadout) {
    return null;
  }
  const uptimeFactor = DRONE_CONFIG.balance?.uptimeFactors?.[loadout.id] ?? 0.4;
  const damageMultiplier = finitePositive(stats.bulletDamage, GAME_CONFIG.projectile.baseDamage) / GAME_CONFIG.projectile.baseDamage;
  const bodyDamage = loadout.bodyDamage * damageMultiplier;
  const rawDps = loadout.maxDrones * bodyDamage / Math.max(EPSILON, loadout.hitCooldownMs / 1000);
  return {
    maxDrones: loadout.maxDrones,
    bodyDamage,
    effectiveDps: rawDps * uptimeFactor
  };
}

export function getClassVisualSignature(classId, config = TANK_CLASS_CONFIG) {
  const tankClass = config.classes[classId] ?? config.classes[config.defaultClassId];
  const icon = tankClass.icon ?? {};
  const barrels = (icon.barrels ?? [])
    .map((barrel) => [
      round(barrel.angle),
      round(barrel.length),
      round(barrel.width),
      barrel.style ?? "standard"
    ].join(":"))
    .join(",");
  const accents = (icon.accents ?? [])
    .map((accent) => [
      accent.type,
      round(accent.angle),
      round(accent.size),
      round(accent.offset)
    ].join(":"))
    .join(",");
  return [
    icon.body ?? "circle",
    round(icon.bodyScale ?? 1),
    icon.ring ?? "none",
    icon.core ?? "none",
    `a(${accents})`,
    `b(${barrels})`
  ].join("|");
}

function getShotDamage(stats, shot) {
  return stats.bulletDamage * finitePositive(shot.damageMultiplier, 1);
}

function isForwardShot(shot) {
  return Math.abs(normalizeAngle(shot.angleOffset ?? 0)) <= FORWARD_ARC_RADIANS;
}

function normalizeAngle(angle) {
  let value = Number(angle) || 0;
  while (value > Math.PI) {
    value -= Math.PI * 2;
  }
  while (value < -Math.PI) {
    value += Math.PI * 2;
  }
  return value;
}

function safeRatio(value, base) {
  const numerator = Number(value);
  const denominator = Number(base);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || Math.abs(denominator) < EPSILON) {
    return 0;
  }
  return numerator / denominator;
}

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function round(value) {
  return Math.round(Number(value) * 1000) / 1000;
}
