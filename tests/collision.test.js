import test from "node:test";
import assert from "node:assert/strict";
import { circleIntersects, getFirstCircleHit, wouldOverlapAny } from "../shared/sim/collision.js";

test("circle intersection includes touching edges", () => {
  assert.equal(circleIntersects({ x: 0, y: 0, radius: 10 }, { x: 20, y: 0, radius: 10 }), true);
  assert.equal(circleIntersects({ x: 0, y: 0, radius: 10 }, { x: 21, y: 0, radius: 10 }), false);
});

test("first hit ignores excluded owner and returns nearest deterministic target", () => {
  const projectile = { id: "bullet-1", x: 0, y: 0, radius: 8 };
  const owner = { id: "tank-1", x: 0, y: 0, radius: 22, state: "alive" };
  const near = { id: "tank-2", x: 12, y: 0, radius: 22, state: "alive" };
  const far = { id: "tank-3", x: 18, y: 0, radius: 22, state: "alive" };

  assert.equal(getFirstCircleHit(projectile, [owner, far, near], owner.id), near);
});

test("overlap helper respects padding", () => {
  const circle = { x: 0, y: 0, radius: 10 };
  const candidate = { x: 40, y: 0, radius: 10, state: "alive" };

  assert.equal(wouldOverlapAny(circle, [candidate], 19), false);
  assert.equal(wouldOverlapAny(circle, [candidate], 20), true);
});
