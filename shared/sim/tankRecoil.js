import { COMBAT_FEEL_CONFIG } from "../config/combatFeelConfig.js";
import { GAME_CONFIG } from "../config/gameConfig.js";

const EPSILON = 0.0001;

export function normalizeShotRecoilMetadata(shot = {}) {
  const angleOffset = finiteNumber(shot.angleOffset, 0);
  const damageMultiplier = finitePositive(shot.damageMultiplier, 1);
  const recoilRole = normalizeRecoilRole(shot.recoilRole, angleOffset);
  return {
    angleOffset,
    angle: finiteNumber(shot.angle, null),
    damageMultiplier,
    kind: String(shot.kind ?? "bullet"),
    radius: finitePositive(shot.radius, GAME_CONFIG.projectile.radius),
    recoilWeight: finitePositive(shot.recoilWeight ?? shot.recoilMultiplier, 1),
    recoilRole
  };
}

export function inferRecoilRole(angleOffset = 0) {
  const angle = Math.abs(normalizeAngle(angleOffset));
  if (angle <= 0.55) {
    return "front";
  }
  if (Math.abs(Math.PI - angle) <= 0.55 || angle >= 2.35) {
    return "rear";
  }
  if (angle >= 1.0 && angle <= 2.15) {
    return "side";
  }
  return "radial";
}

export function computeFireRecoilImpulse({
  tank,
  projectiles = [],
  shots = null,
  aimAngle = tank?.aimAngle ?? tank?.angle ?? 0,
  classRecoilMultiplier = tank?.recoilMultiplier ?? 1,
  baseProjectileRadius = GAME_CONFIG.projectile.radius,
  config = COMBAT_FEEL_CONFIG
} = {}) {
  if (!config.recoil?.enabled) {
    return emptyImpulse();
  }

  const entries = normalizeRecoilEntries(projectiles.length > 0 ? projectiles : shots);
  if (entries.length === 0) {
    return emptyImpulse();
  }

  let x = 0;
  let y = 0;
  const baseImpulse = finitePositive(config.recoil.baseImpulse, COMBAT_FEEL_CONFIG.recoil.baseImpulse);
  const classMultiplier = finitePositive(classRecoilMultiplier, 1);

  for (const entry of entries) {
    const shotAngle = entry.angle === null ? finiteNumber(aimAngle, 0) + entry.angleOffset : entry.angle;
    const kindMultiplier = getKindRecoilMultiplier(entry, baseProjectileRadius, config);
    const impulse = baseImpulse
      * classMultiplier
      * kindMultiplier
      * finitePositive(entry.recoilWeight, 1)
      * Math.min(2.5, finitePositive(entry.damageMultiplier, 1));
    x += -Math.cos(shotAngle) * impulse;
    y += -Math.sin(shotAngle) * impulse;
  }

  const normalization = getMultiShotNormalization(entries.length, config);
  x *= normalization;
  y *= normalization;
  const speed = Math.hypot(x, y);
  return {
    x,
    y,
    speed,
    shotCount: entries.length,
    dominantRole: getDominantRecoilRole(entries)
  };
}

export function applyRecoilImpulse(tank, impulse, config = COMBAT_FEEL_CONFIG) {
  if (!tank || !impulse || tank.state === "dead") {
    return tank;
  }
  tank.recoilX = finiteNumber(tank.recoilX, 0) + finiteNumber(impulse.x, 0);
  tank.recoilY = finiteNumber(tank.recoilY, 0) + finiteNumber(impulse.y, 0);
  clampRecoilVelocity(tank, config);
  return tank;
}

export function decayRecoilVelocity(tank, dtSeconds, config = COMBAT_FEEL_CONFIG) {
  if (!tank) {
    return tank;
  }
  const decayPerSecond = finitePositive(config.recoil?.decayPerSecond, COMBAT_FEEL_CONFIG.recoil.decayPerSecond);
  const decay = Math.max(0, 1 - decayPerSecond * Math.max(0, Number(dtSeconds) || 0));
  tank.recoilX = Math.abs(finiteNumber(tank.recoilX, 0)) < 0.01 ? 0 : finiteNumber(tank.recoilX, 0) * decay;
  tank.recoilY = Math.abs(finiteNumber(tank.recoilY, 0)) < 0.01 ? 0 : finiteNumber(tank.recoilY, 0) * decay;
  return tank;
}

export function clampRecoilVelocity(tank, config = COMBAT_FEEL_CONFIG) {
  const maxSpeed = finitePositive(config.recoil?.maxRecoilSpeed, COMBAT_FEEL_CONFIG.recoil.maxRecoilSpeed);
  const speed = Math.hypot(finiteNumber(tank.recoilX, 0), finiteNumber(tank.recoilY, 0));
  if (speed > maxSpeed) {
    const scale = maxSpeed / speed;
    tank.recoilX *= scale;
    tank.recoilY *= scale;
  }
  return tank;
}

export function summarizeRecoilImpulse(impulse) {
  return {
    x: round(impulse?.x ?? 0),
    y: round(impulse?.y ?? 0),
    speed: round(impulse?.speed ?? 0),
    shotCount: impulse?.shotCount ?? 0,
    dominantRole: impulse?.dominantRole ?? "none"
  };
}

function normalizeRecoilEntries(entries) {
  return [...(entries ?? [])].map(normalizeShotRecoilMetadata);
}

function getKindRecoilMultiplier(entry, baseProjectileRadius, config) {
  const kindMultiplier = config.recoil?.kindMultiplier?.[entry.kind] ?? 1;
  const roleMultiplier = entry.recoilRole === "heavy"
    ? finitePositive(config.recoil?.heavyClassMultiplier, 1)
    : entry.recoilRole === "trap"
      ? finitePositive(config.recoil?.trapClassMultiplier, 1)
      : 1;
  const radiusMultiplier = entry.radius > Math.max(EPSILON, baseProjectileRadius) * 1.4
    ? finitePositive(config.recoil?.heavyClassMultiplier, 1)
    : 1;
  return kindMultiplier * Math.max(roleMultiplier, radiusMultiplier);
}

function getMultiShotNormalization(count, config) {
  const mode = config.recoil?.multiShotNormalization ?? "sqrt";
  if (mode === "none" || count <= 1) {
    return 1;
  }
  return 1 / Math.sqrt(count);
}

function getDominantRecoilRole(entries) {
  const counts = new Map();
  for (const entry of entries) {
    counts.set(entry.recoilRole, (counts.get(entry.recoilRole) ?? 0) + finitePositive(entry.recoilWeight, 1));
  }
  let bestRole = "front";
  let bestWeight = -Infinity;
  for (const [role, weight] of counts) {
    if (weight > bestWeight) {
      bestRole = role;
      bestWeight = weight;
    }
  }
  return bestRole;
}

function normalizeRecoilRole(role, angleOffset) {
  const value = String(role ?? "");
  return ["front", "rear", "side", "radial", "heavy", "trap", "low"].includes(value)
    ? value
    : inferRecoilRole(angleOffset);
}

function emptyImpulse() {
  return { x: 0, y: 0, speed: 0, shotCount: 0, dominantRole: "none" };
}

function normalizeAngle(angle) {
  let value = finiteNumber(angle, 0);
  while (value > Math.PI) {
    value -= Math.PI * 2;
  }
  while (value < -Math.PI) {
    value += Math.PI * 2;
  }
  return value;
}

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value) {
  return Math.round(Number(value) * 10) / 10;
}
