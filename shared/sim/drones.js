import { DRONE_CONFIG, getDroneLoadout } from "../config/droneConfig.js";

const TWO_PI = Math.PI * 2;
const EPSILON = 0.0001;

export function createDrone({
  id,
  owner,
  loadout,
  slotIndex = 0,
  nowMs = 0,
  converted = false,
  ttlMs = null
}) {
  const orbitAngle = getOrbitAngle(slotIndex, loadout.maxDrones, nowMs, loadout);
  const radius = converted ? Math.max(6, loadout.radius * 0.92) : loadout.radius;
  const maxHp = converted ? Math.max(1, loadout.maxHp) : loadout.maxHp;
  const x = finite(owner?.x) + Math.cos(orbitAngle) * loadout.orbitRadius;
  const y = finite(owner?.y) + Math.sin(orbitAngle) * loadout.orbitRadius;
  return {
    id,
    type: "drone",
    kind: "drone",
    behavior: "drone",
    ownerId: owner.id,
    ownerName: owner.name,
    ownerKind: owner.kind,
    classId: owner.classId,
    loadoutId: loadout.id,
    slotIndex,
    converted: Boolean(converted),
    x,
    y,
    prevX: x,
    prevY: y,
    vx: 0,
    vy: 0,
    angle: orbitAngle,
    radius,
    hp: maxHp,
    maxHp,
    bodyDamage: loadout.bodyDamage,
    moveSpeed: loadout.moveSpeed,
    hitCooldownMs: loadout.hitCooldownMs,
    hitCooldowns: {},
    mode: "spawning",
    targetX: x,
    targetY: y,
    orbitAngle,
    spawnedAtMs: nowMs,
    expiresAtMs: ttlMs ? nowMs + ttlMs : 0,
    state: "active",
    fillColor: converted
      ? loadout.render?.convertedBodyColor ?? loadout.render?.bodyColor
      : loadout.render?.bodyColor,
    outlineColor: loadout.render?.outlineColor,
    ownerColor: owner.color
  };
}

export function buildDroneCommand(owner, loadout) {
  const aimAngle = Number(owner?.input?.aimAngle ?? owner?.aimAngle);
  const active = Boolean(owner?.input?.fire && Number.isFinite(aimAngle));
  const distance = finitePositive(loadout.commandDistance, DRONE_CONFIG.loadouts.overseer.commandDistance);
  return {
    active,
    aimAngle: Number.isFinite(aimAngle) ? aimAngle : finite(owner?.aimAngle),
    targetX: finite(owner?.x) + Math.cos(Number.isFinite(aimAngle) ? aimAngle : finite(owner?.aimAngle)) * distance,
    targetY: finite(owner?.y) + Math.sin(Number.isFinite(aimAngle) ? aimAngle : finite(owner?.aimAngle)) * distance
  };
}

export function updateDroneMotion({ drone, owner, loadout, command, dtSeconds, nowMs, world }) {
  if (!drone || drone.state !== "active") {
    return drone;
  }
  if (!owner || owner.state !== "alive") {
    drone.state = "expired";
    return drone;
  }
  if (drone.expiresAtMs && nowMs >= drone.expiresAtMs) {
    drone.state = "expired";
    return drone;
  }

  const ownerDistance = Math.hypot(drone.x - owner.x, drone.y - owner.y);
  let target = getOrbitTarget({ drone, owner, loadout, nowMs });
  let mode = "orbit";
  if (ownerDistance > loadout.leashDistance) {
    mode = "return";
  } else if (command?.active) {
    mode = "attack";
    target = getAttackTarget({ drone, owner, loadout, command });
  }

  drone.mode = mode;
  drone.targetX = target.x;
  drone.targetY = target.y;
  drone.prevX = drone.x;
  drone.prevY = drone.y;

  const desired = normalize(target.x - drone.x, target.y - drone.y);
  const desiredVx = desired.x * loadout.moveSpeed;
  const desiredVy = desired.y * loadout.moveSpeed;
  const blend = Math.max(0, Math.min(1, loadout.turnRate * dtSeconds));
  drone.vx += (desiredVx - drone.vx) * blend;
  drone.vy += (desiredVy - drone.vy) * blend;
  const speed = Math.hypot(drone.vx, drone.vy);
  if (speed > loadout.moveSpeed) {
    drone.vx = (drone.vx / speed) * loadout.moveSpeed;
    drone.vy = (drone.vy / speed) * loadout.moveSpeed;
  }
  if (speed > EPSILON) {
    drone.angle = Math.atan2(drone.vy, drone.vx);
  }

  drone.x += drone.vx * dtSeconds;
  drone.y += drone.vy * dtSeconds;
  pushCircleIntoWorld(drone, world);
  return drone;
}

export function shouldDroneHitTarget(drone, target, nowMs = 0) {
  if (!drone || drone.state !== "active" || !target || target.state !== "alive") {
    return false;
  }
  const lastAt = drone.hitCooldowns?.[target.id] ?? -Infinity;
  return nowMs - lastAt >= finitePositive(drone.hitCooldownMs, 360);
}

export function recordDroneTargetHit(drone, targetId, nowMs = 0) {
  drone.hitCooldowns ??= {};
  drone.hitCooldowns[targetId] = nowMs;
}

export function applyDroneDamage(drone, amount = 0) {
  if (!drone || drone.state !== "active") {
    return 0;
  }
  const applied = Math.min(drone.hp, Math.max(0, Number(amount) || 0));
  drone.hp -= applied;
  if (drone.hp <= 0) {
    drone.hp = 0;
    drone.state = "dead";
  }
  return applied;
}

export function getOwnerDroneCounts(drones, ownerId, loadout = null) {
  const active = [...(drones?.values?.() ?? drones ?? [])].filter((drone) => drone.ownerId === ownerId && drone.state === "active");
  const converted = active.filter((drone) => drone.converted).length;
  return {
    ownerId,
    current: active.length,
    converted,
    base: active.length - converted,
    baseCap: loadout?.baseDrones ?? 0,
    max: loadout?.maxDrones ?? active.length
  };
}

export function expireOwnerDrones(drones, ownerId) {
  let expired = 0;
  for (const drone of drones?.values?.() ?? []) {
    if (drone.ownerId === ownerId && drone.state === "active") {
      drone.state = "expired";
      expired += 1;
    }
  }
  return expired;
}

export function getDroneSnapshot(drone) {
  return {
    id: drone.id,
    ownerId: drone.ownerId,
    ownerName: drone.ownerName,
    ownerKind: drone.ownerKind,
    classId: drone.classId,
    loadoutId: drone.loadoutId,
    converted: Boolean(drone.converted),
    mode: drone.mode,
    x: round1(drone.x),
    y: round1(drone.y),
    prevX: round1(drone.prevX ?? drone.x),
    prevY: round1(drone.prevY ?? drone.y),
    vx: Math.round(drone.vx ?? 0),
    vy: Math.round(drone.vy ?? 0),
    angle: drone.angle ?? 0,
    radius: drone.radius,
    hp: Math.round(drone.hp),
    maxHp: Math.round(drone.maxHp),
    targetX: round1(drone.targetX ?? drone.x),
    targetY: round1(drone.targetY ?? drone.y),
    fillColor: drone.fillColor,
    outlineColor: drone.outlineColor,
    ownerColor: drone.ownerColor
  };
}

export function canConvertShapeToDrone({ tank, shape, loadout, rng = Math.random }) {
  if (!tank || tank.state !== "alive" || !shape || shape.isCenterObjective || shape.isEventObjective) {
    return { converted: false, count: 0, reason: "invalid" };
  }
  const rule = loadout?.conversionRules?.[shape.shapeType];
  if (!rule) {
    return { converted: false, count: 0, reason: "unsupportedShape" };
  }
  if (rng() > rule.chance) {
    return { converted: false, count: 0, reason: "chance" };
  }
  return { converted: true, count: Math.max(1, Math.trunc(rule.count)) };
}

export function getLoadoutOrDefault(loadoutId) {
  return getDroneLoadout(loadoutId) ?? DRONE_CONFIG.loadouts.overseer;
}

function getOrbitTarget({ drone, owner, loadout, nowMs }) {
  const angle = getOrbitAngle(drone.slotIndex, loadout.maxDrones, nowMs, loadout);
  drone.orbitAngle = angle;
  return {
    x: owner.x + Math.cos(angle) * loadout.orbitRadius,
    y: owner.y + Math.sin(angle) * loadout.orbitRadius
  };
}

function getAttackTarget({ drone, owner, loadout, command }) {
  const angle = command.aimAngle + Math.PI / 2;
  const slotCenter = (loadout.maxDrones - 1) / 2;
  const offsetIndex = (drone.slotIndex ?? 0) - slotCenter;
  const spreadPx = offsetIndex * loadout.commandSpread * 72;
  return {
    x: command.targetX + Math.cos(angle) * spreadPx,
    y: command.targetY + Math.sin(angle) * spreadPx
  };
}

function getOrbitAngle(slotIndex, maxDrones, nowMs, loadout) {
  const slot = Number.isFinite(Number(slotIndex)) ? Number(slotIndex) : 0;
  const count = Math.max(1, Number(maxDrones) || 1);
  const spin = (Number(nowMs) || 0) / 1000 * loadout.orbitAngularSpeed;
  return spin + (slot / count) * TWO_PI;
}

function normalize(x, y) {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length < EPSILON) {
    return { x: 0, y: 0 };
  }
  return { x: x / length, y: y / length };
}

function pushCircleIntoWorld(entity, world) {
  if (!world) {
    return entity;
  }
  const radius = Math.max(0, Number(entity.radius) || 0);
  entity.x = Math.max(radius, Math.min(world.width - radius, finite(entity.x)));
  entity.y = Math.max(radius, Math.min(world.height - radius, finite(entity.y)));
  return entity;
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finitePositive(value, fallback) {
  const number = finite(value, fallback);
  return number > 0 ? number : fallback;
}

function round1(value) {
  return Math.round(finite(value) * 10) / 10;
}
