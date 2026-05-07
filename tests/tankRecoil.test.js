import test from "node:test";
import assert from "node:assert/strict";
import { COMBAT_FEEL_CONFIG } from "../shared/config/combatFeelConfig.js";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";
import { getWeaponPattern } from "../shared/sim/tankClasses.js";
import {
  applyRecoilImpulse,
  computeFireRecoilImpulse,
  decayRecoilVelocity
} from "../shared/sim/tankRecoil.js";

test("directional recoil pushes booster forward from rear shots", () => {
  const booster = recoilForClass("booster");
  const basic = recoilForClass("basic");

  assert.ok(booster.x > 0, `booster should thrust forward, got ${booster.x}`);
  assert.ok(basic.x < 0, `basic should kick backward, got ${basic.x}`);
  assert.ok(booster.speed > 6);
});

test("flank and radial weapon recoil cancels instead of kicking backward", () => {
  for (const classId of ["flankGuard", "quadTank", "octoTank", "tripleTwin"]) {
    const impulse = recoilForClass(classId);
    assert.ok(Math.abs(impulse.x) < 2.5, `${classId} x recoil ${impulse.x}`);
    assert.ok(impulse.speed < 2.5, `${classId} speed ${impulse.speed}`);
  }
});

test("heavy cannons kick harder than basic while traps and body classes stay mild", () => {
  const basic = recoilForClass("basic");
  const destroyer = recoilForClass("destroyer");
  const annihilator = recoilForClass("annihilator");
  const trapper = recoilForClass("trapper");
  const spike = recoilForClass("spike");

  assert.ok(destroyer.x < basic.x);
  assert.ok(annihilator.speed > destroyer.speed);
  assert.ok(trapper.speed < basic.speed);
  assert.ok(spike.speed < trapper.speed);
});

test("recoil application clamps and decays safely", () => {
  const tank = { state: "alive", recoilX: 0, recoilY: 0 };
  applyRecoilImpulse(tank, { x: 1000, y: 1000 }, COMBAT_FEEL_CONFIG);
  assert.ok(Math.hypot(tank.recoilX, tank.recoilY) <= COMBAT_FEEL_CONFIG.recoil.maxRecoilSpeed + 0.001);
  const before = Math.hypot(tank.recoilX, tank.recoilY);

  decayRecoilVelocity(tank, 1 / 30, COMBAT_FEEL_CONFIG);

  assert.ok(Math.hypot(tank.recoilX, tank.recoilY) < before);
});

function recoilForClass(classId) {
  return computeFireRecoilImpulse({
    tank: { classId, aimAngle: 0, recoilMultiplier: 1, state: "alive" },
    shots: getWeaponPattern(classId),
    aimAngle: 0,
    classRecoilMultiplier: 1,
    baseProjectileRadius: GAME_CONFIG.projectile.radius,
    config: COMBAT_FEEL_CONFIG
  });
}
