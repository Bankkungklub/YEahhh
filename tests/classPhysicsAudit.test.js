import test from "node:test";
import assert from "node:assert/strict";
import {
  getClassPhysicsSummary,
  validateClassPhysicsCoherence
} from "../shared/sim/classPhysicsAudit.js";

test("class physics audit validates expected class recoil roles", () => {
  assert.deepEqual(validateClassPhysicsCoherence(), []);
});

test("class physics summary exposes representative recoil vectors", () => {
  const summary = getClassPhysicsSummary();

  assert.equal(summary.booster.dominantRole, "rear");
  assert.ok(summary.booster.x > 0);
  assert.ok(summary.fighter.x > 0);
  assert.ok(summary.triAngle.x > 0);
  assert.ok(summary.destroyer.x < 0);
  assert.equal(summary.annihilator.dominantRole, "heavy");
  assert.ok(summary.octoTank.speed < 2.5);
  assert.equal(summary.siegeCore.dominantRole, "heavy");
  assert.equal(summary.aegisBastion.dominantRole, "trap");
  assert.equal(summary.hiveLord.dominantRole, "none");
  assert.ok(summary.comet.x > summary.fighter.x);
});
