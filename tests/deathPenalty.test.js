import test from "node:test";
import assert from "node:assert/strict";
import { ServerGame } from "../server/src/serverGame.js";
import { GAME_CONFIG, UPGRADE_KEYS } from "../shared/config/gameConfig.js";
import { createProjectile } from "../shared/sim/entityFactory.js";
import { getTotalUpgradeBudgetForLevel, xpRewardForTankKill } from "../shared/sim/progression.js";

function createTestGame() {
  const config = JSON.parse(JSON.stringify(GAME_CONFIG));
  config.shapes.targetCount = 0;
  config.bots.baseCount = 0;
  config.bots.perHuman = 0;
  return new ServerGame({ config, rng: () => 0.5 });
}

function setUpgradeLevels(tank, value) {
  for (const key of UPGRADE_KEYS) {
    tank.upgrades[key] = value;
  }
}

test("player death halves level, score, class path, XP, and upgrade budget", () => {
  const game = createTestGame();
  const killer = game.createHumanPlayer("client-killer", "Killer");
  const victim = game.createHumanPlayer("client-victim", "Victim");
  victim.level = 30;
  victim.xp = 777;
  victim.score = 1001;
  victim.classId = "tripleShot";
  victim.classHistory = ["basic", "twin", "tripleShot"];
  victim.upgradePoints = 0;
  setUpgradeLevels(victim, 3);

  const oldLevelReward = xpRewardForTankKill({ kind: "player", level: 30 });
  const oldProjectile = createProjectile({
    id: "victim-old-shot",
    owner: victim,
    nowMs: game.timeMs,
    config: game.config
  });
  game.projectiles.set(oldProjectile.id, oldProjectile);

  game.damageTank(victim, {
    ownerId: killer.id,
    ownerName: killer.name,
    damage: victim.hp + 10
  });

  assert.equal(killer.score, oldLevelReward);
  assert.equal(victim.state, "dead");
  assert.equal(victim.level, 15);
  assert.equal(victim.xp, 0);
  assert.equal(victim.score, 500);
  assert.equal(victim.classId, "twin");
  assert.deepEqual(victim.classHistory, ["basic", "twin"]);
  assert.equal(victim.upgradePoints, getTotalUpgradeBudgetForLevel(15));
  for (const key of UPGRADE_KEYS) {
    assert.equal(victim.upgrades[key], 0);
  }
  assert.equal(oldProjectile.state, "expired");

  const deathEvent = game.pendingEvents.find((event) => event.type === "death");
  assert.equal(deathEvent.oldLevel, 30);
  assert.equal(deathEvent.newLevel, 15);
  assert.equal(deathEvent.oldClassId, "tripleShot");
  assert.equal(deathEvent.newClassId, "twin");
  assert.equal(deathEvent.scoreLost, 501);
});

test("level 45 death keeps the deepest valid previous branch class", () => {
  const game = createTestGame();
  const killer = game.createHumanPlayer("client-killer", "Killer");
  const victim = game.createHumanPlayer("client-victim", "Victim");
  victim.level = 45;
  victim.score = 5000;
  victim.classId = "stalker";
  victim.classHistory = ["basic", "sniper", "assassin", "stalker"];

  game.damageTank(victim, {
    ownerId: killer.id,
    ownerName: killer.name,
    damage: victim.hp + 10
  });

  assert.equal(victim.level, 23);
  assert.equal(victim.classId, "sniper");
  assert.deepEqual(victim.classHistory, ["basic", "sniper"]);
  assert.equal(victim.score, 2500);
});

test("bot death penalty also halves bot progression and downgrades class", () => {
  const game = createTestGame();
  const killer = game.createHumanPlayer("client-killer", "Killer");
  game.config.bots.baseCount = 1;
  game.step(1 / game.config.server.tickRate);
  const bot = [...game.tanks.values()].find((tank) => tank.kind === "bot");
  bot.level = 30;
  bot.score = 900;
  bot.classId = "tripleShot";
  bot.classHistory = ["basic", "twin", "tripleShot"];
  setUpgradeLevels(bot, 2);

  game.damageTank(bot, {
    ownerId: killer.id,
    ownerName: killer.name,
    damage: bot.hp + 10
  });

  assert.equal(bot.level, 15);
  assert.equal(bot.score, 450);
  assert.equal(bot.classId, "twin");
  assert.equal(bot.upgradePoints, getTotalUpgradeBudgetForLevel(15));
  for (const key of UPGRADE_KEYS) {
    assert.equal(bot.upgrades[key], 0);
  }
});
