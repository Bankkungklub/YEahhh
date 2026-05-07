import test from "node:test";
import assert from "node:assert/strict";
import { validateTankClassConfig } from "../shared/config/tankClassConfig.js";
import {
  canSelectClass,
  downgradeClassForLevel,
  getAvailableClassChoices,
  getClassAdjustedTankStats,
  getClassPath,
  getWeaponPattern,
  selectTankClass
} from "../shared/sim/tankClasses.js";

test("tank class config validates and exposes stable paths", () => {
  assert.deepEqual(validateTankClassConfig(), []);
  assert.deepEqual(getClassPath("triplet"), ["basic", "twin", "tripleShot", "triplet"]);
  assert.deepEqual(getClassPath("booster"), ["basic", "flankGuard", "triAngle", "booster"]);
  assert.deepEqual(getClassPath("annihilator"), ["basic", "machineGun", "destroyer", "annihilator"]);
  assert.deepEqual(getClassPath("starburst"), ["basic", "machineGun", "fireworkTank", "starburst"]);
  assert.deepEqual(getClassPath("missileCommand"), ["basic", "machineGun", "fireworkTank", "starburst", "missileCommand"]);
  assert.deepEqual(getClassPath("minefield"), ["basic", "sniper", "trapper", "minefield"]);
  assert.deepEqual(getClassPath("hiveLord"), ["basic", "sniper", "overseer", "necromancer", "hiveLord"]);
  assert.deepEqual(getClassPath("spike"), ["basic", "flankGuard", "rammer", "spike"]);
});

test("level 15 choices unlock from the basic tank only", () => {
  const tank = createTankProgress({ level: 15, classId: "basic" });

  assert.deepEqual(getAvailableClassChoices(tank).sort(), ["flankGuard", "machineGun", "sniper", "twin"]);
  assert.equal(canSelectClass(tank, "destroyer"), false);
});

test("level 30 and 45 choices unlock along the selected branch", () => {
  const tank = createTankProgress({ level: 45, classId: "basic" });

  assert.equal(selectTankClass(tank, "twin"), true);
  assert.deepEqual(getAvailableClassChoices(tank).sort(), ["quadTank", "tripleShot"]);
  assert.equal(selectTankClass(tank, "tripleShot"), true);
  assert.deepEqual(getAvailableClassChoices(tank).sort(), ["pentaShot", "triplet"]);
  assert.equal(selectTankClass(tank, "triplet"), true);
  assert.deepEqual(tank.classHistory, ["basic", "twin", "tripleShot", "triplet"]);
});

test("every level 30 branch has playable level 45 endings", () => {
  const levelThirtyClasses = [
    "tripleShot",
    "quadTank",
    "twinFlank",
    "triAngle",
    "assassin",
    "overseer",
    "hunter",
    "destroyer",
    "gunner",
    "fireworkTank",
    "trapper",
    "rammer"
  ];

  for (const classId of levelThirtyClasses) {
    const tank = createTankFromPath(getClassPath(classId), 45);
    const choices = getAvailableClassChoices(tank);
    assert.ok(choices.length > 0, `${classId} should have a level 45 child`);
    for (const choice of choices) {
      assert.equal(canSelectClass(tank, choice), true, `${classId} can select ${choice}`);
    }
  }
});

test("new level 45 endings follow their legal parents and reject sibling jumps", () => {
  const triAngle = createTankFromPath(["basic", "flankGuard", "triAngle"], 45);
  const destroyer = createTankFromPath(["basic", "machineGun", "destroyer"], 45);
  const firework = createTankFromPath(["basic", "machineGun", "fireworkTank"], 45);
  const trapper = createTankFromPath(["basic", "sniper", "trapper"], 45);
  const rammer = createTankFromPath(["basic", "flankGuard", "rammer"], 45);
  const twin = createTankFromPath(["basic", "twin"], 45);

  assert.deepEqual(getAvailableClassChoices(triAngle).sort(), ["booster", "fighter"]);
  assert.equal(selectTankClass(triAngle, "booster"), true);
  assert.deepEqual(getAvailableClassChoices(destroyer).sort(), ["annihilator", "hybrid"]);
  assert.equal(selectTankClass(destroyer, "annihilator"), true);
  assert.deepEqual(getAvailableClassChoices(firework), ["starburst"]);
  assert.deepEqual(getAvailableClassChoices(trapper), ["minefield"]);
  assert.deepEqual(getAvailableClassChoices(rammer), ["spike"]);
  assert.equal(selectTankClass(twin, "hunter"), false);
});

test("level 60 ultimate choices unlock only from configured level 45 parents", () => {
  const cases = [
    [["basic", "machineGun", "fireworkTank", "starburst"], ["missileCommand"]],
    [["basic", "machineGun", "gunner", "sprayer"], ["stormcaller"]],
    [["basic", "machineGun", "destroyer", "annihilator"], ["siegeCore"]],
    [["basic", "sniper", "overseer", "necromancer"], ["hiveLord"]],
    [["basic", "sniper", "trapper", "minefield"], ["aegisBastion"]],
    [["basic", "flankGuard", "triAngle", "fighter"], ["comet"]]
  ];

  for (const [path, choices] of cases) {
    const tank = createTankFromPath(path, 60);
    assert.deepEqual(getAvailableClassChoices(tank), choices, `${path.at(-1)} level 60 choices`);
    assert.equal(canSelectClass(tank, choices[0]), true);
  }

  const booster = createTankFromPath(["basic", "flankGuard", "triAngle", "booster"], 60);
  assert.deepEqual(getAvailableClassChoices(booster), []);
  assert.equal(canSelectClass(booster, "comet"), false);
});

test("selecting a class records history and blocks sibling jumps", () => {
  const tank = createTankProgress({ level: 15, classId: "basic" });

  assert.equal(selectTankClass(tank, "twin"), true);
  assert.equal(tank.classId, "twin");
  assert.deepEqual(tank.classHistory, ["basic", "twin"]);
  assert.equal(selectTankClass(tank, "sniper"), false);
});

test("locked classes still reject early level and branch jumps", () => {
  const tank = createTankProgress({ level: 45, classId: "twin" });

  assert.equal(canSelectClass(createTankProgress({ level: 29, classId: "twin" }), "tripleShot"), false);
  assert.equal(canSelectClass(tank, "tripleShot"), true);
  assert.equal(canSelectClass(tank, "triplet"), false);
  assert.equal(selectTankClass(tank, "sniper"), false);
});

test("death downgrade keeps the deepest valid class on the existing branch", () => {
  const triplet = {
    level: 45,
    classId: "triplet",
    classHistory: ["basic", "twin", "tripleShot", "triplet"]
  };
  const stalker = {
    level: 45,
    classId: "stalker",
    classHistory: ["basic", "sniper", "assassin", "stalker"]
  };

  assert.equal(downgradeClassForLevel(triplet, 23).classId, "twin");
  assert.deepEqual(triplet.classHistory, ["basic", "twin"]);
  assert.equal(downgradeClassForLevel(stalker, 23).classId, "sniper");
  assert.deepEqual(stalker.classHistory, ["basic", "sniper"]);
  assert.equal(downgradeClassForLevel(createTankProgress({ level: 15, classId: "twin" }), 8).classId, "basic");

  const comet = {
    level: 60,
    classId: "comet",
    classHistory: ["basic", "flankGuard", "triAngle", "fighter", "comet"]
  };
  assert.equal(downgradeClassForLevel(comet, 30).classId, "triAngle");
  assert.deepEqual(comet.classHistory, ["basic", "flankGuard", "triAngle"]);
});

test("death downgrade falls back to basic when class history is corrupt", () => {
  const tank = {
    level: 45,
    classId: "triplet",
    classHistory: ["basic", "sniper", "triplet"]
  };

  assert.equal(downgradeClassForLevel(tank, 45).classId, "sniper");
  assert.deepEqual(tank.classHistory, ["basic", "sniper"]);
});

test("class stat modifiers remain finite and weapon patterns are concrete", () => {
  const baseStats = {
    radius: 22,
    maxHp: 100,
    moveSpeed: 245,
    bulletDamage: 12,
    bulletSpeed: 680,
    reloadMs: 430,
    regenDelayMs: 6000,
    regenPerSecond: 1
  };
  const sniperStats = getClassAdjustedTankStats(baseStats, "sniper");
  const machineGunStats = getClassAdjustedTankStats(baseStats, "machineGun");

  assert.equal(getWeaponPattern("basic").length, 1);
  assert.equal(getWeaponPattern("twin").length, 2);
  assert.equal(getWeaponPattern("flankGuard").length, 2);
  assert.equal(getWeaponPattern("octoTank").length, 8);
  assert.equal(getWeaponPattern("overseer").length, 0);
  assert.equal(getWeaponPattern("overlord").length, 0);
  assert.equal(getWeaponPattern("necromancer").length, 0);
  assert.equal(getWeaponPattern("hiveLord").length, 0);
  assert.equal(getWeaponPattern("missileCommand").length, 3);
  assert.equal(getWeaponPattern("stormcaller").length, 8);
  assert.equal(getWeaponPattern("aegisBastion").length, 5);
  assert.ok(Number.isFinite(sniperStats.bulletDamage));
  assert.ok(sniperStats.bulletSpeed > baseStats.bulletSpeed);
  assert.ok(machineGunStats.reloadMs < baseStats.reloadMs);
});

function createTankProgress({ level, classId }) {
  return {
    level,
    classId,
    classHistory: [classId]
  };
}

function createTankFromPath(path, level) {
  return {
    level,
    classId: path[path.length - 1],
    classHistory: [...path]
  };
}
