import { COMBAT_FEEL_CONFIG } from "../config/combatFeelConfig.js";

export function getContactResolution(a, b, pushStrength = 1) {
  const dx = Number(a.x) - Number(b.x);
  const dy = Number(a.y) - Number(b.y);
  const distance = Math.hypot(dx, dy);
  const radiusA = Math.max(0, Number(a.radius) || 0);
  const radiusB = Math.max(0, Number(b.radius) || 0);
  const overlap = radiusA + radiusB - distance;

  if (overlap <= 0) {
    return {
      colliding: false,
      overlap: 0,
      normalX: 0,
      normalY: 0,
      pushX: 0,
      pushY: 0
    };
  }

  const normalX = distance > 0.0001 ? dx / distance : 1;
  const normalY = distance > 0.0001 ? dy / distance : 0;
  return {
    colliding: true,
    overlap,
    normalX,
    normalY,
    pushX: normalX * overlap * pushStrength,
    pushY: normalY * overlap * pushStrength
  };
}

export function calculateTankShapeContactDamage({
  tank,
  shape,
  dtSeconds,
  config = COMBAT_FEEL_CONFIG.contactCollision
}) {
  const speed = Math.hypot((tank.vx ?? 0) + (tank.recoilX ?? 0), (tank.vy ?? 0) + (tank.recoilY ?? 0));
  const speedRatio = clamp(speed / 260, 0, 1.8);
  const bodyDamage = positiveOrDefault(tank.bodyDamageMultiplier, 1);
  const bodyResistance = positiveOrDefault(tank.bodyResistance, 1);
  const eventMultiplier = positiveOrDefault(shape.eventContactMultiplier, 1);
  const shapeMultiplier = shape.isCenterObjective ? config.alphaDamageMultiplier : eventMultiplier;
  const seconds = Math.max(0, Number(dtSeconds) || 0);

  return {
    tankToShape: (config.baseTankBodyDps + speedRatio * 24) * bodyDamage * seconds,
    shapeToTank: (config.baseShapeBodyDps + speedRatio * 18) * bodyResistance * shapeMultiplier * seconds
  };
}

export function calculateTankTankContactDamage({
  source,
  target,
  dtSeconds,
  config = COMBAT_FEEL_CONFIG.contactCollision
}) {
  const relativeSpeed = Math.hypot((source.vx ?? 0) - (target.vx ?? 0), (source.vy ?? 0) - (target.vy ?? 0));
  const speedRatio = clamp(relativeSpeed / 260, 0, 1.8);
  const bodyDamage = positiveOrDefault(source.bodyDamageMultiplier, 1);
  const targetResistance = positiveOrDefault(target.bodyResistance, 1);
  const seconds = Math.max(0, Number(dtSeconds) || 0);
  return (config.baseTankBodyDps + speedRatio * 24) * bodyDamage * targetResistance * seconds;
}

export function pushCircleIntoWorld(circle, world) {
  const radius = Math.max(0, Number(circle.radius) || 0);
  circle.x = clamp(circle.x, radius, world.width - radius);
  circle.y = clamp(circle.y, radius, world.height - radius);
  return circle;
}

function positiveOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
