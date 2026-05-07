import test from "node:test";
import assert from "node:assert/strict";
import { TANK_CLASS_CONFIG } from "../shared/config/tankClassConfig.js";
import {
  getPrimaryProjectileKind,
  getTankWeaponFacts,
  getTankWeaponFactChips,
  getWeaponPatternCadenceSummary,
  validateTankWeaponFacts
} from "../shared/sim/tankWeaponFacts.js";

test("weapon facts validate coverage and mobile-safe chip lengths", () => {
  assert.deepEqual(validateTankWeaponFacts(), []);

  for (const tankClass of Object.values(TANK_CLASS_CONFIG.classes)) {
    if (!tankClass.active) {
      continue;
    }
    const facts = getTankWeaponFacts(tankClass.id);
    assert.ok(facts.facts.length >= 2, `${tankClass.id} should expose at least two weapon facts`);
    assert.ok(facts.facts.every((chip) => chip.length <= 18), `${tankClass.id} has a long chip`);
  }
});

test("rapid branch weapon facts expose timed cadence windows", () => {
  const expectations = {
    gunner: { count: 4, window: 84, damageSum: 1.8 },
    autoGunner: { count: 5, window: 96, damageSum: 1.72 },
    sprayer: { count: 7, window: 120, damageSum: 1.96 }
  };

  for (const [classId, expected] of Object.entries(expectations)) {
    const facts = getTankWeaponFacts(classId);
    assert.equal(facts.shotCount, expected.count, `${classId} count`);
    assert.equal(facts.burstWindowMs, expected.window, `${classId} window`);
    assert.equal(facts.damageSum, expected.damageSum, `${classId} damage sum`);
    assert.ok(facts.facts.includes(`${expected.window}ms spray`), `${classId} spray fact`);
  }
});

test("special archetypes expose concrete mechanical facts", () => {
  assert.deepEqual(getTankWeaponFactChips("hiveLord").slice(0, 3), ["drone 10", "base 5", "shape convert"]);
  assert.ok(getTankWeaponFactChips("aegisBastion").includes("trap blocks"));
  assert.ok(getTankWeaponFactChips("missileCommand").includes("850ms steer"));
  assert.ok(getTankWeaponFactChips("siegeCore").includes("heavy shell"));
  assert.ok(getTankWeaponFactChips("hybrid").includes("shell escort"));
  assert.ok(getTankWeaponFactChips("spike").includes("body damage"));
});

test("weapon pattern summaries derive facts from config instead of manual copy", () => {
  const pattern = TANK_CLASS_CONFIG.weaponPatterns.stormcaller;
  const summary = getWeaponPatternCadenceSummary(pattern);

  assert.equal(summary.shotCount, 8);
  assert.equal(summary.burstWindowMs, 175);
  assert.equal(summary.spreadWidthRadians, 1.24);
  assert.equal(getPrimaryProjectileKind(pattern), "bullet");
});
