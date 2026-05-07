import test from "node:test";
import assert from "node:assert/strict";
import { clampMotionToWorld, normalizeMoveInput, simulateTankMotion } from "../shared/sim/tankMotion.js";

test("tank motion moves right by speed over one second", () => {
  const result = simulateTankMotion({
    tank: { x: 100, y: 100, radius: 22 },
    input: { moveX: 1, moveY: 0 },
    moveSpeed: 245,
    dtSeconds: 1,
    world: { width: 1000, height: 1000 }
  });

  assert.equal(result.x, 345);
  assert.equal(result.y, 100);
  assert.equal(result.vx, 245);
  assert.equal(result.vy, 0);
});

test("diagonal motion is normalized", () => {
  const move = normalizeMoveInput({ moveX: 1, moveY: 1 });
  const length = Math.hypot(move.x, move.y);

  assert.ok(Math.abs(length - 1) < 0.000001);
});

test("motion clamps tank to world bounds", () => {
  const result = simulateTankMotion({
    tank: { x: 90, y: 90, radius: 22 },
    input: { moveX: -1, moveY: -1 },
    moveSpeed: 245,
    dtSeconds: 1,
    world: { width: 1000, height: 1000 }
  });

  assert.equal(result.x, 22);
  assert.equal(result.y, 22);
});

test("invalid input never produces NaN", () => {
  const result = simulateTankMotion({
    tank: { x: Number.NaN, y: undefined, radius: 22 },
    input: { moveX: Number.NaN, moveY: Infinity },
    moveSpeed: Number.NaN,
    dtSeconds: Number.NaN,
    world: { width: 1000, height: 1000 }
  });

  assert.deepEqual(result, { x: 22, y: 22, vx: 0, vy: 0 });
});

test("clamp helper tolerates missing world", () => {
  assert.deepEqual(clampMotionToWorld({ x: 100, y: 100, radius: 22 }), {
    x: 22,
    y: 22
  });
});
