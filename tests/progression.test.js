import test from "node:test";
import assert from "node:assert/strict";
import { getLevelPacingMultiplier } from "../shared/config/balanceConfig.js";
import { GAME_CONFIG, getTankStats, validateConfig } from "../shared/config/gameConfig.js";
import {
  addXp,
  applyDeathProgressionPenalty,
  applyUpgrade,
  createProgression,
  getDeathPenaltyLevel,
  getTotalUpgradeBudgetForLevel,
  upgradePointsForLevel,
  xpForNextLevel
} from "../shared/sim/progression.js";

test("config validates and XP formula is deterministic", () => {
  assert.deepEqual(validateConfig(GAME_CONFIG), []);
  assert.equal(xpForNextLevel(1), Math.floor((60 + 35 * 1 ** 1.7) * getLevelPacingMultiplier(1)));
  assert.equal(xpForNextLevel(10), Math.floor((60 + 35 * 10 ** 1.7) * getLevelPacingMultiplier(10)));
});

test("large XP awards multiple levels and upgrade points", () => {
  const progress = createProgression();
  const result = addXp(progress, 5000, 5000);

  assert.ok(result.levelsGained > 1);
  assert.ok(progress.level > 2);
  assert.ok(progress.upgradePoints > 0);
  assert.equal(progress.score, 5000);
});

test("progression caps at level 60", () => {
  const progress = createProgression();
  addXp(progress, 99999999, 0);

  assert.equal(progress.level, 60);
  assert.ok(progress.xp < xpForNextLevel(60));
});

test("upgrade levels alter concrete tank stats and respect max level", () => {
  const progress = createProgression();
  progress.upgradePoints = 20;

  for (let i = 0; i < GAME_CONFIG.upgrades.maxLevel + 2; i += 1) {
    applyUpgrade(progress, "bulletDamage");
  }

  assert.equal(progress.upgrades.bulletDamage, GAME_CONFIG.upgrades.maxLevel);
  assert.equal(upgradePointsForLevel(29), 0);
  assert.equal(upgradePointsForLevel(30), 1);
  assert.ok(getTankStats(progress.upgrades).bulletDamage > GAME_CONFIG.projectile.baseDamage);
});

test("death penalty halves level, resets XP, halves score, and refunds legal upgrade budget", () => {
  const progress = createProgression();
  progress.kind = "player";
  progress.level = 30;
  progress.xp = 900;
  progress.score = 1234;
  progress.upgradePoints = 0;
  progress.upgrades.bulletDamage = 5;
  progress.upgrades.reload = 4;

  const summary = applyDeathProgressionPenalty(progress);

  assert.equal(getDeathPenaltyLevel(30), 15);
  assert.equal(summary.oldLevel, 30);
  assert.equal(summary.newLevel, 15);
  assert.equal(progress.level, 15);
  assert.equal(progress.xp, 0);
  assert.equal(progress.score, 617);
  assert.equal(summary.scoreLost, 617);
  assert.equal(progress.upgradePoints, getTotalUpgradeBudgetForLevel(15));
  for (const value of Object.values(progress.upgrades)) {
    assert.equal(value, 0);
  }
});

test("death penalty keeps level one at level one", () => {
  const progress = createProgression();
  progress.kind = "bot";
  progress.level = 1;

  const summary = applyDeathProgressionPenalty(progress);

  assert.equal(summary.newLevel, 1);
  assert.equal(progress.level, 1);
  assert.equal(progress.upgradePoints, getTotalUpgradeBudgetForLevel(1));
});
