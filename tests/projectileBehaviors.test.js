import test from "node:test";
import assert from "node:assert/strict";
import { COMBAT_FEEL_CONFIG } from "../shared/config/combatFeelConfig.js";
import {
  canProjectileHitTarget,
  canTrapBlockProjectile,
  createExplosionSparkProjectiles,
  findMissileTarget,
  getProjectileKindCounts,
  recordProjectileTargetHit,
  recordTrapProjectileBlock,
  rotateTowardAngle,
  updateProjectileBehavior
} from "../shared/sim/projectileBehaviors.js";

test("rocket explosion creates capped spark projectiles once per request", () => {
  const rocket = createProjectile({ kind: "rocket", behavior: "starburst", damage: 40 });
  const sparks = createExplosionSparkProjectiles({
    projectile: rocket,
    nextId: (prefix) => `${prefix}-${Math.random()}`,
    nowMs: 1000
  });

  assert.equal(sparks.length, COMBAT_FEEL_CONFIG.projectileBehaviors.starburst.sparkCount);
  assert.equal(sparks.every((spark) => spark.kind === "spark"), true);
  assert.ok(sparks.every((spark) => spark.damage > 0));
});

test("trap arms after delay, stops moving, and expires by hit count", () => {
  const trap = createProjectile({ kind: "trap", behavior: "trap" });

  trap.ageMs = 100;
  updateProjectileBehavior(trap, 16);
  assert.equal(trap.armed, false);
  assert.notEqual(trap.vx, 0);

  trap.ageMs = 260;
  updateProjectileBehavior(trap, 16);
  assert.equal(trap.armed, true);
  assert.equal(trap.vx, 0);
  assert.equal(canProjectileHitTarget(trap, "shape-1", 300), true);

  recordProjectileTargetHit(trap, "shape-1", 300);
  recordProjectileTargetHit(trap, "shape-2", 760);
  recordProjectileTargetHit(trap, "shape-3", 1220);
  assert.equal(trap.state, "expired");
});

test("armed hostile traps can block configured projectile kinds", () => {
  const trap = createProjectile({
    id: "trap-1",
    kind: "trap",
    behavior: "trap",
    ownerId: "trapper",
    armed: true,
    remainingHits: 3,
    hitCooldowns: {}
  });
  const bullet = createProjectile({
    id: "bullet-1",
    kind: "bullet",
    ownerId: "enemy"
  });

  assert.equal(canTrapBlockProjectile(trap, bullet, 500), true);
  assert.equal(recordTrapProjectileBlock(trap, bullet, 500), true);
  assert.equal(bullet.state, "expired");
  assert.equal(trap.remainingHits, 2);
});

test("trap projectile blocking rejects unarmed, friendly, and trap projectiles", () => {
  const unarmedTrap = createProjectile({
    id: "trap-1",
    kind: "trap",
    behavior: "trap",
    ownerId: "trapper",
    armed: false,
    remainingHits: 3,
    hitCooldowns: {}
  });
  const friendlyBullet = createProjectile({
    id: "bullet-1",
    kind: "bullet",
    ownerId: "trapper"
  });
  const enemyTrap = createProjectile({
    id: "trap-2",
    kind: "trap",
    behavior: "trap",
    ownerId: "enemy",
    armed: true,
    remainingHits: 3,
    hitCooldowns: {}
  });

  assert.equal(canTrapBlockProjectile(unarmedTrap, createProjectile({ id: "bullet-2", ownerId: "enemy" }), 500), false);
  unarmedTrap.armed = true;
  assert.equal(canTrapBlockProjectile(unarmedTrap, friendlyBullet, 500), false);
  assert.equal(canTrapBlockProjectile(unarmedTrap, enemyTrap, 500), false);
});

test("limited-turn missile steers toward hostile targets and stops after steer window", () => {
  const missile = createProjectile({
    id: "missile-1",
    kind: "rocket",
    behavior: "missile",
    ownerId: "owner",
    x: 100,
    y: 100,
    vx: 200,
    vy: 0,
    angle: 0,
    ageMs: 0
  });
  const target = { id: "enemy", type: "tank", state: "alive", x: 400, y: 250 };

  updateProjectileBehavior(missile, 100, COMBAT_FEEL_CONFIG, { dtSeconds: 0.1, targets: [target] });

  assert.ok(missile.angle > 0);
  assert.ok(missile.angle <= COMBAT_FEEL_CONFIG.projectileBehaviors.missile.turnRateRadPerSec * 0.1 + 0.0001);

  const steeredAngle = missile.angle;
  missile.ageMs = COMBAT_FEEL_CONFIG.projectileBehaviors.missile.maxSteerMs;
  updateProjectileBehavior(missile, 100, COMBAT_FEEL_CONFIG, { dtSeconds: 0.1, targets: [target] });
  assert.equal(missile.angle, steeredAngle);
});

test("missile targeting rejects owner and out-of-cone candidates", () => {
  const missile = createProjectile({
    id: "missile-1",
    kind: "rocket",
    behavior: "missile",
    ownerId: "owner",
    x: 100,
    y: 100,
    vx: 200,
    vy: 0,
    angle: 0
  });

  assert.equal(findMissileTarget(missile, [{ id: "owner", state: "alive", x: 200, y: 100 }]), null);
  assert.equal(findMissileTarget(missile, [{ id: "behind", state: "alive", x: 20, y: 100 }]), null);
  assert.equal(findMissileTarget(missile, [{ id: "enemy", state: "alive", x: 240, y: 110 }])?.id, "enemy");
  assert.equal(Number.isFinite(rotateTowardAngle(0, Math.PI, 0.2)), true);
});

test("projectile kind counts group active behavior metadata", () => {
  assert.deepEqual(getProjectileKindCounts([
    createProjectile({ kind: "bullet" }),
    createProjectile({ kind: "rocket" }),
    createProjectile({ kind: "rocket" }),
    createProjectile({ kind: "trap" })
  ]), {
    bullet: 1,
    rocket: 2,
    trap: 1
  });
});

function createProjectile(overrides = {}) {
  return {
    id: "projectile-1",
    type: "projectile",
    kind: "bullet",
    behavior: "bullet",
    ownerId: "tank-1",
    ownerName: "Bank",
    ownerKind: "player",
    x: 100,
    y: 100,
    prevX: 100,
    prevY: 100,
    vx: 200,
    vy: 0,
    angle: 0,
    radius: 6,
    damage: 20,
    ageMs: 0,
    ttlMs: 1000,
    createdAtMs: 0,
    state: "active",
    ...overrides
  };
}
