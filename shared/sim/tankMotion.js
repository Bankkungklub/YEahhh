import { clamp, normalize } from "./vector.js";

export function simulateTankMotion({ tank, input, moveSpeed, dtSeconds, world }) {
  const move = normalizeMoveInput(input);
  const safeDt = Math.max(0, Number(dtSeconds) || 0);
  const speed = Math.max(0, Number(moveSpeed) || 0);
  const radius = Math.max(0, Number(tank?.radius) || 0);
  const startX = Number.isFinite(Number(tank?.x)) ? Number(tank.x) : radius;
  const startY = Number.isFinite(Number(tank?.y)) ? Number(tank.y) : radius;
  const vx = move.x * speed;
  const vy = move.y * speed;
  const position = clampMotionToWorld({
    x: startX + vx * safeDt,
    y: startY + vy * safeDt,
    radius,
    world
  });

  return {
    x: position.x,
    y: position.y,
    vx,
    vy
  };
}

export function normalizeMoveInput(input = {}) {
  return normalize(safeUnit(input.moveX), safeUnit(input.moveY));
}

export function clampMotionToWorld({ x, y, radius = 0, world }) {
  const safeRadius = Math.max(0, Number(radius) || 0);
  const width = Math.max(safeRadius * 2, Number(world?.width) || safeRadius * 2);
  const height = Math.max(safeRadius * 2, Number(world?.height) || safeRadius * 2);
  return {
    x: clamp(safeNumber(x, safeRadius), safeRadius, width - safeRadius),
    y: clamp(safeNumber(y, safeRadius), safeRadius, height - safeRadius)
  };
}

function safeUnit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, numeric));
}

function safeNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
