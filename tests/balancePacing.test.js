import test from "node:test";
import assert from "node:assert/strict";
import { BALANCE_CONFIG, getLevelPacingMultiplier, validateBalanceConfig } from "../shared/config/balanceConfig.js";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";
import {
  addXp,
  createProgression,
  xpForNextLevel,
  xpForShape,
  xpRewardForTankKill
} from "../shared/sim/progression.js";

function oldXpForNextLevel(level) {
  return Math.floor(GAME_CONFIG.xp.base + GAME_CONFIG.xp.levelScale * level ** GAME_CONFIG.xp.levelExponent);
}

test("balance config validates and applies exact level pacing bands", () => {
  assert.deepEqual(validateBalanceConfig(BALANCE_CONFIG), []);

  assert.equal(getLevelPacingMultiplier(1), 0.22);
  assert.equal(getLevelPacingMultiplier(14), 0.22);
  assert.equal(getLevelPacingMultiplier(15), 0.36);
  assert.equal(getLevelPacingMultiplier(29), 0.36);
  assert.equal(getLevelPacingMultiplier(30), 0.55);
});

test("XP requirements are faster than the old curve at representative levels", () => {
  assert.equal(xpForNextLevel(1), 20);
  assert.equal(xpForNextLevel(10), 399);
  assert.equal(xpForNextLevel(15), 1279);
  assert.equal(xpForNextLevel(30), 6277);
  assert.equal(xpForNextLevel(1), Math.floor(oldXpForNextLevel(1) * 0.22));
  assert.equal(xpForNextLevel(10), Math.floor(oldXpForNextLevel(10) * 0.22));
  assert.equal(xpForNextLevel(15), Math.floor(oldXpForNextLevel(15) * 0.36));
  assert.equal(xpForNextLevel(30), Math.floor(oldXpForNextLevel(30) * 0.55));
});

test("new tanks start with three upgrade points and level up faster from shapes", () => {
  const progress = createProgression();
  assert.equal(progress.upgradePoints, 3);

  for (let i = 0; i < 10; i += 1) {
    addXp(progress, xpForShape("square"), xpForShape("square"));
  }

  assert.ok(progress.level >= 2);
  assert.ok(progress.upgradePoints >= 2);
});

test("one alpha reward unlocks the first class tier for a fresh tank", () => {
  const progress = createProgression();
  const result = addXp(progress, xpForShape("alphaPentagon"), xpForShape("alphaPentagon"));

  assert.ok(result.levelsGained >= 14);
  assert.ok(progress.level >= 15);
});

test("reward helpers return tuned shape and tank kill XP", () => {
  assert.equal(xpForShape("square"), 35);
  assert.equal(xpForShape("triangle"), 80);
  assert.equal(xpForShape("pentagon"), 220);
  assert.equal(xpForShape("alphaPentagon"), 4200);
  assert.equal(xpRewardForTankKill({ kind: "bot", level: 3 }), 368);
  assert.equal(xpRewardForTankKill({ kind: "player", level: 3 }), 484);
});
