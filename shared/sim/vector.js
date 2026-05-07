export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function length(x, y) {
  return Math.hypot(x, y);
}

export function normalize(x, y) {
  const len = length(x, y);
  if (len <= 0.00001) {
    return { x: 0, y: 0 };
  }
  return { x: x / len, y: y / len };
}

export function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function angleToVector(angle) {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function clampToWorld(entity, world) {
  entity.x = clamp(entity.x, entity.radius, world.width - entity.radius);
  entity.y = clamp(entity.y, entity.radius, world.height - entity.radius);
}

export function randomRange(rng, min, max) {
  return min + (max - min) * rng();
}

export function randomPointInWorld(rng, world, radius = 0) {
  return {
    x: randomRange(rng, radius, world.width - radius),
    y: randomRange(rng, radius, world.height - radius)
  };
}
