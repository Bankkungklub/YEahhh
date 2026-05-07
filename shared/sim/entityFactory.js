import { GAME_CONFIG, getTankStats } from "../config/gameConfig.js";
import { COMBAT_FEEL_CONFIG, getProjectileVisual } from "../config/combatFeelConfig.js";
import { TANK_CLASS_CONFIG } from "../config/tankClassConfig.js";
import { getDefaultLoadout } from "./cosmetics.js";
import { createProgression } from "./progression.js";
import { getClassAdjustedTankStats, refreshClassUnlocks } from "./tankClasses.js";
import { getProjectileFeedbackProfile } from "./tankClassIdentity.js";
import { angleToVector } from "./vector.js";

export function createTank({
  id,
  clientId = null,
  name,
  x,
  y,
  color,
  kind = "player",
  nowMs = 0,
  config = GAME_CONFIG,
  accountId = null,
  cosmetics = null,
  classId = TANK_CLASS_CONFIG.defaultClassId
}) {
  const progress = createProgression();
  const stats = getClassAdjustedTankStats(getTankStats(progress.upgrades, config), classId);
  const loadout = { ...getDefaultLoadout(), ...(cosmetics ?? {}) };

  const tank = {
    ...progress,
    id,
    type: "tank",
    kind,
    classId,
    classHistory: [classId],
    classUnlockChoices: [],
    accountId,
    clientId,
    name,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: 0,
    aimAngle: 0,
    radius: stats.radius,
    color: loadout.bodyColor ?? color,
    cosmetics: loadout,
    matchCoinsEarned: 0,
    matchCoinsRaw: 0,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    bodyDamageMultiplier: stats.bodyDamageMultiplier ?? 1,
    bodyResistance: stats.bodyResistance ?? 1,
    recoilMultiplier: stats.recoilMultiplier ?? 1,
    recoilX: 0,
    recoilY: 0,
    barrelKickUntilMs: 0,
    fireCooldownMs: 0,
    lastDamageAtMs: -Infinity,
    lastDamageSource: null,
    lastDamageEventByCauseAtMs: {},
    spawnedAtMs: nowMs,
    respawnAtMs: 0,
    disconnectedAtMs: null,
    state: "alive",
    killerName: "",
    input: {
      moveX: 0,
      moveY: 0,
      aimAngle: 0,
      fire: false,
      seq: 0
    },
    ai: kind === "bot"
      ? {
          mode: "wander",
          targetId: null,
          reactionAtMs: 0,
          wanderUntilMs: 0,
          wanderX: x,
          wanderY: y,
          spawnedAtMs: nowMs,
          lastGovernedAtMs: nowMs,
          pendingRecycle: false
        }
      : null
  };
  refreshClassUnlocks(tank);
  return tank;
}

export function refreshTankStats(tank, config = GAME_CONFIG) {
  const stats = getClassAdjustedTankStats(getTankStats(tank.upgrades, config), tank.classId);
  const oldMaxHp = tank.maxHp || stats.maxHp;
  tank.radius = stats.radius;
  tank.maxHp = stats.maxHp;
  tank.bodyDamageMultiplier = stats.bodyDamageMultiplier ?? 1;
  tank.bodyResistance = stats.bodyResistance ?? 1;
  tank.recoilMultiplier = stats.recoilMultiplier ?? 1;
  tank.hp = Math.min(stats.maxHp, tank.hp + Math.max(0, stats.maxHp - oldMaxHp));
  return stats;
}

export function createProjectile({
  id,
  owner,
  nowMs = 0,
  config = GAME_CONFIG,
  angleOffset = 0,
  lateralOffset = 0,
  damageMultiplier = 1,
  speedMultiplier = 1,
  kind = "bullet",
  behavior = "bullet",
  barrelLength = 0,
  recoilWeight = 1,
  recoilRole = "front",
  recoilMultiplier = null
}) {
  const stats = getClassAdjustedTankStats(getTankStats(owner.upgrades, config), owner.classId);
  const angle = owner.aimAngle + angleOffset;
  const direction = angleToVector(angle);
  const lateral = { x: -direction.y, y: direction.x };
  const projectileRadius = Math.max(1, stats.projectileRadius ?? config.projectile.radius);
  const spawnOffset = owner.radius + projectileRadius + barrelLength + COMBAT_FEEL_CONFIG.muzzle.spawnExtraPx;
  const x = owner.x + direction.x * spawnOffset + lateral.x * lateralOffset;
  const y = owner.y + direction.y * spawnOffset + lateral.y * lateralOffset;
  const visual = getProjectileVisual(kind);
  const ttlMs = behavior === "trap"
    ? COMBAT_FEEL_CONFIG.projectileBehaviors.trap.ttlMs
    : Math.max(100, stats.projectileTtlMs ?? config.projectile.ttlMs);

  return {
    id,
    type: "projectile",
    kind,
    behavior,
    ownerId: owner.id,
    ownerClassId: owner.classId,
    feedbackProfile: getProjectileFeedbackProfile(owner.classId),
    ownerName: owner.name,
    ownerKind: owner.kind,
    x,
    y,
    prevX: x,
    prevY: y,
    vx: direction.x * stats.bulletSpeed * speedMultiplier,
    vy: direction.y * stats.bulletSpeed * speedMultiplier,
    angle,
    angleOffset,
    lateralOffset,
    radius: projectileRadius,
    damage: stats.bulletDamage * damageMultiplier,
    damageMultiplier,
    speedMultiplier,
    barrelLength,
    recoilWeight: recoilMultiplier ?? recoilWeight,
    recoilRole,
    ageMs: 0,
    ttlMs,
    createdAtMs: nowMs,
    spawnX: x,
    spawnY: y,
    fillColor: visual.fill,
    coreColor: visual.core,
    trailColor: visual.trail,
    trailMs: visual.trailMs,
    trailAlpha: visual.trailAlpha,
    outlineColor: visual.outlineColor,
    outlineWidth: visual.outlineWidth,
    pulseColor: visual.pulseColor,
    warningRing: visual.warningRing,
    impactStyle: visual.impactStyle,
    armed: behavior !== "trap",
    remainingHits: behavior === "trap" ? COMBAT_FEEL_CONFIG.projectileBehaviors.trap.maxHits : 1,
    hitCooldowns: behavior === "trap" ? {} : null,
    state: "active"
  };
}

export function createShape({ id, shapeType, x, y, config = GAME_CONFIG }) {
  const shape = config.shapes.types[shapeType];
  if (!shape) {
    throw new Error(`Unknown shape type: ${shapeType}`);
  }

  return {
    id,
    type: "shape",
    shapeType,
    x,
    y,
    radius: shape.radius,
    hp: shape.hp,
    maxHp: shape.hp,
    xp: shape.xp,
    sides: shape.sides,
    color: shape.color,
    isCenterObjective: Boolean(shape.isCenterObjective),
    spawnable: shape.spawnable !== false,
    state: "alive"
  };
}
