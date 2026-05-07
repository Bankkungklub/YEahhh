import { COMBAT_FEEL_CONFIG } from "../config/combatFeelConfig.js";

export function getProjectileBehavior(projectileOrKind, config = COMBAT_FEEL_CONFIG) {
  const behaviorId = typeof projectileOrKind === "string"
    ? projectileOrKind
    : projectileOrKind?.behavior ?? projectileOrKind?.kind ?? "bullet";
  return config.projectileBehaviors[behaviorId] ?? null;
}

export function updateProjectileBehavior(projectile, dtMs, config = COMBAT_FEEL_CONFIG, context = {}) {
  if (!projectile || projectile.state !== "active") {
    return projectile;
  }
  if (projectile.behavior === "missile") {
    updateMissileBehavior(projectile, dtMs, config, context);
    return projectile;
  }
  if (projectile.kind !== "trap" && projectile.behavior !== "trap") {
    return projectile;
  }

  const trap = config.projectileBehaviors.trap;
  if (projectile.ageMs >= trap.stopAfterMs) {
    projectile.vx = 0;
    projectile.vy = 0;
  }
  projectile.armed = projectile.ageMs >= trap.armMs;
  projectile.remainingHits ??= trap.maxHits;
  projectile.hitCooldowns ??= {};
  projectile.ttlMs = Math.max(projectile.ttlMs ?? 0, trap.ttlMs);
  return projectile;
}

export function shouldDetonateProjectile(projectile) {
  return projectile?.kind === "rocket" || projectile?.behavior === "rocket" || projectile?.behavior === "starburst" || projectile?.behavior === "missile";
}

export function updateMissileBehavior(projectile, dtMs, config = COMBAT_FEEL_CONFIG, context = {}) {
  const behavior = config.projectileBehaviors?.missile;
  if (!behavior || projectile?.state !== "active") {
    return projectile;
  }
  if ((projectile.ageMs ?? 0) >= behavior.maxSteerMs) {
    return projectile;
  }

  const candidates = context.targets ?? context.tanks ?? [];
  const target = findMissileTarget(projectile, candidates, behavior);
  if (!target) {
    return projectile;
  }

  const speed = Math.hypot(projectile.vx ?? 0, projectile.vy ?? 0);
  if (!Number.isFinite(speed) || speed <= 0) {
    return projectile;
  }

  const currentAngle = Number.isFinite(projectile.angle)
    ? projectile.angle
    : Math.atan2(projectile.vy ?? 0, projectile.vx ?? 0);
  const desiredAngle = Math.atan2(target.y - projectile.y, target.x - projectile.x);
  const dtSeconds = Number.isFinite(context.dtSeconds)
    ? Math.max(0, context.dtSeconds)
    : Math.max(0, Number(dtMs) || 0) / 1000;
  const newAngle = rotateTowardAngle(currentAngle, desiredAngle, behavior.turnRateRadPerSec * dtSeconds);

  projectile.angle = newAngle;
  projectile.vx = Math.cos(newAngle) * speed;
  projectile.vy = Math.sin(newAngle) * speed;
  return projectile;
}

export function findMissileTarget(projectile, candidates = [], behavior = COMBAT_FEEL_CONFIG.projectileBehaviors.missile) {
  if (!projectile || !behavior) {
    return null;
  }
  const baseAngle = Number.isFinite(projectile.angle)
    ? projectile.angle
    : Math.atan2(projectile.vy ?? 0, projectile.vx ?? 0);
  let best = null;
  let bestDistanceSq = Infinity;

  for (const candidate of candidates ?? []) {
    if (!candidate || candidate.id === projectile.ownerId || candidate.ownerId === projectile.ownerId) {
      continue;
    }
    if (candidate.state && candidate.state !== "alive" && candidate.state !== "active") {
      continue;
    }
    if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) {
      continue;
    }
    const dx = candidate.x - projectile.x;
    const dy = candidate.y - projectile.y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq > behavior.targetAcquireRange * behavior.targetAcquireRange) {
      continue;
    }
    const angleToTarget = Math.atan2(dy, dx);
    if (Math.abs(normalizeAngle(angleToTarget - baseAngle)) > behavior.targetConeRadians) {
      continue;
    }
    if (distanceSq < bestDistanceSq) {
      best = candidate;
      bestDistanceSq = distanceSq;
    }
  }

  return best;
}

export function rotateTowardAngle(currentAngle, targetAngle, maxTurn) {
  const safeCurrent = Number.isFinite(currentAngle) ? currentAngle : 0;
  const safeTarget = Number.isFinite(targetAngle) ? targetAngle : safeCurrent;
  const safeMaxTurn = Math.max(0, Number(maxTurn) || 0);
  const delta = normalizeAngle(safeTarget - safeCurrent);
  if (Math.abs(delta) <= safeMaxTurn) {
    return safeTarget;
  }
  return safeCurrent + Math.sign(delta) * safeMaxTurn;
}

export function createExplosionSparkProjectiles({
  projectile,
  nextId,
  nowMs = 0,
  config = COMBAT_FEEL_CONFIG
}) {
  const behavior = getProjectileBehavior(projectile, config);
  if (!behavior || !shouldDetonateProjectile(projectile)) {
    return [];
  }

  const speed = Math.max(80, Math.hypot(projectile.vx ?? 0, projectile.vy ?? 0) * behavior.sparkSpeedMultiplier);
  const count = Math.max(1, Math.min(16, Math.trunc(behavior.sparkCount)));
  const radius = Math.max(3, (projectile.radius ?? 6) * 0.44);
  const baseAngle = Number.isFinite(projectile.angle) ? projectile.angle : 0;
  const sparks = [];

  for (let index = 0; index < count; index += 1) {
    const angle = baseAngle + (Math.PI * 2 * index) / count;
    const id = typeof nextId === "function" ? nextId("spark") : `spark-${projectile.id}-${index}`;
    sparks.push({
      id,
      type: "projectile",
      kind: "spark",
      behavior: "bullet",
      ownerId: projectile.ownerId,
      ownerName: projectile.ownerName,
      ownerKind: projectile.ownerKind,
      x: projectile.x,
      y: projectile.y,
      prevX: projectile.x,
      prevY: projectile.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      radius,
      damage: Math.max(1, projectile.damage * behavior.sparkDamageMultiplier),
      ageMs: 0,
      ttlMs: behavior.sparkTtlMs,
      createdAtMs: nowMs,
      state: "active",
      spawnX: projectile.x,
      spawnY: projectile.y,
      fillColor: config.projectileVisuals.spark.fill,
      coreColor: config.projectileVisuals.spark.core,
      trailColor: config.projectileVisuals.spark.trail,
      trailMs: config.projectileVisuals.spark.trailMs
    });
  }

  return sparks;
}

export function canProjectileHitTarget(projectile, targetId, nowMs, config = COMBAT_FEEL_CONFIG) {
  if (!projectile || projectile.state !== "active") {
    return false;
  }
  if ((projectile.kind === "trap" || projectile.behavior === "trap") && !projectile.armed) {
    return false;
  }
  const cooldownUntil = projectile.hitCooldowns?.[targetId] ?? 0;
  return nowMs >= cooldownUntil;
}

export function recordProjectileTargetHit(projectile, targetId, nowMs, config = COMBAT_FEEL_CONFIG) {
  if (!projectile || !targetId) {
    return;
  }
  if (projectile.kind !== "trap" && projectile.behavior !== "trap") {
    projectile.state = "expired";
    return;
  }
  const trap = config.projectileBehaviors.trap;
  projectile.hitCooldowns ??= {};
  projectile.remainingHits ??= trap.maxHits;
  projectile.hitCooldowns[targetId] = nowMs + trap.hitCooldownMs;
  projectile.remainingHits -= 1;
  if (projectile.remainingHits <= 0) {
    projectile.state = "expired";
  }
}

export function canTrapBlockProjectile(trap, projectile, nowMs, config = COMBAT_FEEL_CONFIG) {
  const behavior = config.projectileBehaviors?.trap;
  if (!behavior?.blocksProjectiles || !trap || !projectile) {
    return false;
  }
  if (trap.state !== "active" || projectile.state !== "active") {
    return false;
  }
  if (trap.kind !== "trap" && trap.behavior !== "trap") {
    return false;
  }
  if (!trap.armed) {
    return false;
  }
  if (projectile.kind === "trap" || projectile.behavior === "trap") {
    return false;
  }
  if (trap.ownerId && projectile.ownerId && trap.ownerId === projectile.ownerId) {
    return false;
  }
  if (!behavior.blockableKinds?.includes(projectile.kind ?? "bullet")) {
    return false;
  }
  return canProjectileHitTarget(trap, `projectile:${projectile.id}`, nowMs, config);
}

export function recordTrapProjectileBlock(trap, projectile, nowMs, config = COMBAT_FEEL_CONFIG) {
  if (!canTrapBlockProjectile(trap, projectile, nowMs, config)) {
    return false;
  }
  const behavior = config.projectileBehaviors.trap;
  if (behavior.blockConsumesHit) {
    recordProjectileTargetHit(trap, `projectile:${projectile.id}`, nowMs, config);
  }
  projectile.state = "expired";
  return true;
}

export function getProjectileKindCounts(projectiles) {
  const counts = {};
  const values = projectiles instanceof Map ? projectiles.values() : projectiles;
  for (const projectile of values ?? []) {
    const kind = projectile?.kind ?? "bullet";
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  return counts;
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
