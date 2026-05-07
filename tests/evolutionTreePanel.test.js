import test from "node:test";
import assert from "node:assert/strict";
import { getEvolutionNodeStatus } from "../client/src/ui/evolutionTreePanel.js";
import { getClassesByLevelInBranchOrder } from "../shared/sim/classUpgradeViewModel.js";

test("evolution node status marks current, available, locked, and unreachable nodes", () => {
  const levelOne = { level: 1, classId: "basic" };
  assert.equal(getEvolutionNodeStatus(levelOne, "basic"), "selected");
  assert.equal(getEvolutionNodeStatus(levelOne, "twin"), "locked");

  const levelFifteen = { level: 15, classId: "basic" };
  assert.equal(getEvolutionNodeStatus(levelFifteen, "twin"), "available");

  const twin = { level: 15, classId: "twin" };
  assert.equal(getEvolutionNodeStatus(twin, "sniper"), "unreachable");
});

test("evolution tree keeps future branch nodes locked before parent selection", () => {
  const highBasic = { level: 60, classId: "basic" };
  assert.equal(getEvolutionNodeStatus(highBasic, "tripleShot"), "locked");

  const triAngle = { level: 45, classId: "triAngle", classHistory: ["basic", "flankGuard", "triAngle"] };
  assert.equal(getEvolutionNodeStatus(triAngle, "booster"), "available");
  assert.equal(getEvolutionNodeStatus(triAngle, "predator"), "unreachable");

  const fighter = { level: 60, classId: "fighter", classHistory: ["basic", "flankGuard", "triAngle", "fighter"] };
  assert.equal(getEvolutionNodeStatus(fighter, "comet"), "available");
  assert.equal(getEvolutionNodeStatus(fighter, "missileCommand"), "unreachable");
});

test("evolution tree class order follows branch config", () => {
  const byLevel = getClassesByLevelInBranchOrder();
  assert.deepEqual(byLevel.get(15).map((tankClass) => tankClass.id), ["twin", "sniper", "machineGun", "flankGuard"]);
  assert.ok(byLevel.get(45).some((tankClass) => tankClass.id === "annihilator"));
  assert.ok(byLevel.get(60).some((tankClass) => tankClass.id === "missileCommand"));
});
