import test from "node:test";
import assert from "node:assert/strict";
import { TANK_CLASS_CONFIG, validateTankClassConfig } from "../shared/config/tankClassConfig.js";
import { GAME_CONFIG, getTankStats } from "../shared/config/gameConfig.js";
import { getClassAdjustedTankStats, getWeaponPattern } from "../shared/sim/tankClasses.js";
import { getClassBalanceSummary, validateClassBalanceBudgets } from "../shared/sim/tankClassBalance.js";

test("all configured tank classes are active and selectable through level 60", () => {
  assert.deepEqual(validateTankClassConfig(TANK_CLASS_CONFIG), []);
  assert.equal(TANK_CLASS_CONFIG.maxSelectableLevel, 60);
  assert.deepEqual(TANK_CLASS_CONFIG.levels, [1, 15, 30, 45, 60]);
  for (const tankClass of Object.values(TANK_CLASS_CONFIG.classes)) {
    assert.equal(tankClass.active, true, `${tankClass.id} should be active`);
    assert.ok(TANK_CLASS_CONFIG.levels.includes(tankClass.unlockLevel));
  }
});

test("all class modifiers stay finite and projectile counts stay bounded", () => {
  const baseStats = getTankStats({}, GAME_CONFIG);

  for (const tankClass of Object.values(TANK_CLASS_CONFIG.classes)) {
    const stats = getClassAdjustedTankStats(baseStats, tankClass.id);
    const pattern = getWeaponPattern(tankClass.id);

    if (tankClass.droneLoadoutId) {
      assert.equal(pattern.length, 0, `${tankClass.id} should command drones instead of firing projectiles`);
    } else {
      assert.ok(pattern.length >= 1, `${tankClass.id} needs at least one projectile`);
    }
    assert.ok(pattern.length <= 8, `${tankClass.id} should not exceed projectile cap`);
    assert.ok(Number.isFinite(stats.bulletDamage) && stats.bulletDamage > 0, `${tankClass.id} damage`);
    assert.ok(Number.isFinite(stats.bulletSpeed) && stats.bulletSpeed > 0, `${tankClass.id} bullet speed`);
    assert.ok(Number.isFinite(stats.reloadMs) && stats.reloadMs >= GAME_CONFIG.projectile.minReloadMs, `${tankClass.id} reload`);
    assert.ok(Number.isFinite(stats.moveSpeed) && stats.moveSpeed > 0, `${tankClass.id} move speed`);
    assert.ok(Number.isFinite(stats.projectileRadius) && stats.projectileRadius > 0, `${tankClass.id} projectile radius`);
    assert.ok(Number.isFinite(stats.projectileTtlMs) && stats.projectileTtlMs >= 100, `${tankClass.id} projectile ttl`);
  }
});

test("deep branch classes preserve their intended utility identity", () => {
  const baseStats = getTankStats({}, GAME_CONFIG);
  const destroyer = getClassAdjustedTankStats(baseStats, "destroyer");
  const stalker = getClassAdjustedTankStats(baseStats, "stalker");
  const triAngle = getClassAdjustedTankStats(baseStats, "triAngle");

  assert.ok(destroyer.bulletDamage > baseStats.bulletDamage * 2.5);
  assert.ok(destroyer.bulletSpeed < baseStats.bulletSpeed);
  assert.ok(stalker.projectileTtlMs > baseStats.projectileTtlMs);
  assert.ok(stalker.bulletSpeed > baseStats.bulletSpeed);
  assert.ok(triAngle.moveSpeed > baseStats.moveSpeed);
});

test("role-based class balance budgets validate for every class", () => {
  assert.deepEqual(validateClassBalanceBudgets(TANK_CLASS_CONFIG, GAME_CONFIG), []);
});

test("class balance summary exposes finite DPS and utility scores", () => {
  const summary = getClassBalanceSummary(TANK_CLASS_CONFIG, GAME_CONFIG);

  for (const [classId, entry] of Object.entries(summary)) {
    assert.ok(Number.isFinite(entry.focusedDps) && entry.focusedDps >= 0, `${classId} focused DPS`);
    assert.ok(Number.isFinite(entry.totalDps) && entry.totalDps > 0, `${classId} total DPS`);
    assert.ok(Number.isFinite(entry.mobilityScore) && entry.mobilityScore > 0, `${classId} mobility`);
    assert.ok(Number.isFinite(entry.survivabilityScore) && entry.survivabilityScore > 0, `${classId} survivability`);
    assert.ok(Number.isFinite(entry.burstScore) && entry.burstScore > 0, `${classId} burst`);
    assert.ok(entry.visualSignature.includes("b("), `${classId} visual signature`);
  }
});

test("advanced class progression never becomes strictly worse in both total DPS and role utility", () => {
  const summary = getClassBalanceSummary(TANK_CLASS_CONFIG, GAME_CONFIG);

  for (const tankClass of Object.values(TANK_CLASS_CONFIG.classes)) {
    if (!tankClass.parentId || tankClass.unlockLevel < 45) {
      continue;
    }
    const child = summary[tankClass.id];
    const parent = summary[tankClass.parentId];
    const dpsImproved = child.totalDpsRatio >= parent.totalDpsRatio * 0.82;
    const utilityImproved =
      child.mobilityScore >= parent.mobilityScore ||
      child.survivabilityScore >= parent.survivabilityScore ||
      child.burstScore >= parent.burstScore ||
      child.projectileCount >= parent.projectileCount;

    assert.ok(dpsImproved || utilityImproved, `${tankClass.id} should keep DPS or gain utility over ${tankClass.parentId}`);
  }
});
