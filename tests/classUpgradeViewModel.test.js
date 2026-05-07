import test from "node:test";
import assert from "node:assert/strict";
import {
  getBranchOrderedClasses,
  getChoiceShortcut,
  getClassUpgradeViewModel,
  getClassesByLevelInBranchOrder
} from "../shared/sim/classUpgradeViewModel.js";
import { selectTankClass } from "../shared/sim/tankClasses.js";

test("class upgrade view model hides outside active play", () => {
  const tank = createTank({ level: 15, classId: "basic", choices: ["twin"] });

  assert.equal(getClassUpgradeViewModel({ localTank: tank, screen: "menu" }).visible, false);
  assert.equal(getClassUpgradeViewModel({ localTank: { ...tank, state: "dead" }, screen: "playing" }).visible, false);
});

test("level 15 choices render as Diep-style card data with shortcuts", () => {
  const model = getClassUpgradeViewModel({
    localTank: createTank({
      level: 15,
      classId: "basic",
      choices: ["twin", "sniper", "machineGun", "flankGuard"]
    }),
    screen: "playing"
  });

  assert.equal(model.visible, true);
  assert.equal(model.tierLevel, 15);
  assert.deepEqual(model.choices.map((choice) => choice.shortcut), ["1", "2", "3", "4"]);
  assert.deepEqual(model.choices.map((choice) => choice.id), ["twin", "sniper", "machineGun", "flankGuard"]);
  assert.deepEqual(model.choices.map((choice) => choice.identity.roleLabel), [
    "Twin Pressure",
    "Long Range",
    "Rapid Fire",
    "Two-Way Guard"
  ]);
  assert.ok(model.choices.every((choice) => choice.identity.weaponLine.length <= 48));
  assert.ok(model.choices.every((choice) => choice.weaponFacts.facts.length >= 2));
  assert.ok(model.choices.every((choice) => choice.weaponFacts.facts.every((chip) => chip.length <= 18)));
});

test("admin level 60 can progress through sequential tiers", () => {
  const tank = createTank({ level: 60, classId: "basic" });

  let model = getClassUpgradeViewModel({ localTank: tank, screen: "playing" });
  assert.equal(model.tierLevel, 15);
  assert.ok(model.choices.some((choice) => choice.id === "flankGuard"));
  assert.equal(selectTankClass(tank, "flankGuard"), true);

  model = getClassUpgradeViewModel({ localTank: tank, screen: "playing" });
  assert.equal(model.tierLevel, 30);
  assert.deepEqual(model.choices.map((choice) => choice.id), ["twinFlank", "triAngle", "rammer"]);
  assert.equal(selectTankClass(tank, "triAngle"), true);

  model = getClassUpgradeViewModel({ localTank: tank, screen: "playing" });
  assert.equal(model.tierLevel, 45);
  assert.deepEqual(model.choices.map((choice) => choice.id), ["booster", "fighter"]);
  assert.equal(selectTankClass(tank, "fighter"), true);

  model = getClassUpgradeViewModel({ localTank: tank, screen: "playing" });
  assert.equal(model.tierLevel, 60);
  assert.deepEqual(model.choices.map((choice) => choice.id), ["comet"]);
  assert.equal(model.choices[0].identity.feedbackProfile, "booster");
  assert.ok(model.choices[0].weaponFacts.facts.includes("boost recoil"));
});

test("class upgrade view model exposes concrete weapon fact chips", () => {
  const sprayerModel = getClassUpgradeViewModel({
    localTank: createTank({
      level: 45,
      classId: "gunner",
      choices: ["autoGunner", "sprayer"]
    }),
    screen: "playing"
  });
  const sprayer = sprayerModel.choices.find((choice) => choice.id === "sprayer");
  assert.ok(sprayer.weaponFacts.facts.includes("7 shots"));
  assert.ok(sprayer.weaponFacts.facts.includes("120ms spray"));

  const ultimateModel = getClassUpgradeViewModel({
    localTank: createTank({
      level: 60,
      classId: "necromancer",
      choices: ["hiveLord"]
    }),
    screen: "playing"
  });
  assert.ok(ultimateModel.choices[0].weaponFacts.facts.includes("drone 10"));
});

test("branch ordered classes preserve config tree order", () => {
  const ordered = getBranchOrderedClasses();
  const levelThirty = getClassesByLevelInBranchOrder().get(30).map((tankClass) => tankClass.id);

  assert.equal(ordered[0].id, "basic");
  assert.deepEqual(levelThirty.slice(0, 2), ["tripleShot", "quadTank"]);
  assert.ok(getClassesByLevelInBranchOrder().get(60).some((tankClass) => tankClass.id === "comet"));
  assert.equal(getChoiceShortcut(2), "3");
});

function createTank({ level, classId, choices = null }) {
  const tank = {
    id: "tank-test",
    state: "alive",
    level,
    classId,
    classHistory: [classId]
  };
  if (choices) {
    tank.classUnlockChoices = choices;
  }
  return tank;
}
