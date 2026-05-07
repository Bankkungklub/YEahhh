import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateTankShapeContactDamage,
  calculateTankTankContactDamage,
  getContactResolution,
  pushCircleIntoWorld
} from "../shared/sim/contactCollision.js";

test("overlapping tank and shape returns deterministic pushback", () => {
  const resolution = getContactResolution(
    { x: 100, y: 100, radius: 22 },
    { x: 110, y: 100, radius: 24 },
    0.72
  );

  assert.equal(resolution.colliding, true);
  assert.ok(resolution.overlap > 0);
  assert.ok(resolution.pushX < 0);
});

test("zero-distance contact uses stable normal and avoids NaN", () => {
  const resolution = getContactResolution(
    { x: 100, y: 100, radius: 22 },
    { x: 100, y: 100, radius: 24 },
    1
  );

  assert.equal(resolution.colliding, true);
  assert.equal(Number.isFinite(resolution.pushX), true);
  assert.equal(Number.isFinite(resolution.pushY), true);
});

test("contact damage respects rammer body multipliers and alpha reduction", () => {
  const basic = createTank({ bodyDamageMultiplier: 1, bodyResistance: 1 });
  const rammer = createTank({ bodyDamageMultiplier: 1.65, bodyResistance: 0.78 });
  const square = { id: "square", type: "shape", isCenterObjective: false };
  const alpha = { id: "alpha", type: "shape", isCenterObjective: true };

  const basicDamage = calculateTankShapeContactDamage({ tank: basic, shape: square, dtSeconds: 1 });
  const rammerDamage = calculateTankShapeContactDamage({ tank: rammer, shape: square, dtSeconds: 1 });
  const alphaDamage = calculateTankShapeContactDamage({ tank: basic, shape: alpha, dtSeconds: 1 });

  assert.ok(rammerDamage.tankToShape > basicDamage.tankToShape);
  assert.ok(rammerDamage.shapeToTank < basicDamage.shapeToTank);
  assert.ok(alphaDamage.shapeToTank < basicDamage.shapeToTank);
});

test("tank-tank body damage remains finite and world clamp preserves radius", () => {
  const source = createTank({ x: 20, y: 20, vx: 260, bodyDamageMultiplier: 2 });
  const target = createTank({ x: 30, y: 20, vx: 0, bodyResistance: 0.7 });
  const damage = calculateTankTankContactDamage({ source, target, dtSeconds: 0.5 });

  assert.ok(Number.isFinite(damage));
  assert.ok(damage > 0);

  pushCircleIntoWorld(source, { width: 9000, height: 9000 });
  assert.equal(source.x >= source.radius, true);
  assert.equal(source.y >= source.radius, true);
});

function createTank(overrides = {}) {
  return {
    id: "tank",
    type: "tank",
    x: 100,
    y: 100,
    vx: 180,
    vy: 0,
    recoilX: 0,
    recoilY: 0,
    radius: 22,
    bodyDamageMultiplier: 1,
    bodyResistance: 1,
    ...overrides
  };
}
