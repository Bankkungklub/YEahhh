import test from "node:test";
import assert from "node:assert/strict";
import { GAME_CONFIG, UPGRADE_KEYS, getTankStats } from "../shared/config/gameConfig.js";
import { createProjectile } from "../shared/sim/entityFactory.js";
import { BOT_RIVAL_TIERS, createBotRivalState } from "../shared/sim/botRivals.js";
import { getBotLevelCap, updateBots } from "../server/src/botController.js";
import { ServerGame } from "../server/src/serverGame.js";

function createTestConfig() {
  const config = JSON.parse(JSON.stringify(GAME_CONFIG));
  config.shapes.targetCount = 0;
  config.bots.baseCount = 0;
  config.bots.perHuman = 0;
  config.bots.maxCount = 4;
  config.bots.governance.intervalMs = 1000;
  config.bots.governance.maxLevelNoHumans = 3;
  config.bots.governance.maxLevelLeadOverHumans = 2;
  config.bots.governance.maxLevelWithHumans = 8;
  config.bots.governance.recycleAfterMs = 360000;
  config.bots.governance.recycleDistanceFromHuman = 1800;
  config.bots.governance.scoreDecayStartMs = 180000;
  config.bots.governance.scoreDecayPerMinute = 0.15;
  return config;
}

function createGame() {
  const rngValues = [0.12, 0.18, 0.82, 0.77, 0.34, 0.66, 0.5, 0.5];
  return new ServerGame({
    config: createTestConfig(),
    rng: () => rngValues.shift() ?? 0.5
  });
}

function addBot(game, overrides = {}) {
  game.config.bots.baseCount = game.tanks.size + 1;
  game.step(1 / game.config.server.tickRate);
  const bot = [...game.tanks.values()].find((tank) => tank.kind === "bot");
  Object.assign(bot, overrides);
  bot.ai.spawnedAtMs = overrides.spawnedAtMs ?? 0;
  bot.ai.lastGovernedAtMs = overrides.lastGovernedAtMs ?? 0;
  bot.ai.pendingRecycle = overrides.pendingRecycle ?? false;
  return bot;
}

function addHuman(game, overrides = {}) {
  const human = game.createHumanPlayer("client-1", "Bank");
  Object.assign(human, overrides);
  return human;
}

function makeOverLevelBot(bot) {
  bot.level = 6;
  bot.xp = 120;
  bot.score = 900;
  bot.upgradePoints = 0;
  bot.upgrades.bulletDamage = 3;
  bot.upgrades.reload = 2;
  const stats = getTankStats(bot.upgrades, GAME_CONFIG);
  bot.maxHp = stats.maxHp;
  bot.hp = stats.maxHp;
}

test("bot level cap is fixed when no humans are connected", () => {
  const game = createGame();

  assert.equal(getBotLevelCap(game), 3);
});

test("bot level cap follows the highest connected human with a hard maximum", () => {
  const game = createGame();
  addHuman(game, { level: 1 });

  assert.equal(getBotLevelCap(game), 3);

  const human = [...game.tanks.values()].find((tank) => tank.kind === "player");
  human.level = 5;
  assert.equal(getBotLevelCap(game), 7);

  human.level = 40;
  assert.equal(getBotLevelCap(game), 8);
});

test("over-cap bot far from humans recycles to fresh progression", () => {
  const game = createGame();
  const bot = addBot(game);
  makeOverLevelBot(bot);
  bot.ai.rival = { ...createBotRivalState(0), tier: BOT_RIVAL_TIERS.BOUNTY, killStreak: 3 };
  bot.x = 5200;
  bot.y = 5200;
  game.timeMs = 2000;

  updateBots(game);

  assert.equal(bot.level, 1);
  assert.equal(bot.xp, 0);
  assert.equal(bot.score, 0);
  assert.equal(bot.upgradePoints, 3);
  for (const key of UPGRADE_KEYS) {
    assert.equal(bot.upgrades[key], 0);
  }
  assert.equal(bot.hp, bot.maxHp);
  assert.equal(bot.ai.pendingRecycle, false);
  assert.equal(bot.ai.spawnedAtMs, game.timeMs);
  assert.equal(bot.ai.rival.tier, BOT_RIVAL_TIERS.NONE);
  assert.equal(bot.ai.rival.killStreak, 0);
});

test("over-cap bot near a human waits instead of popping out of combat", () => {
  const game = createGame();
  const human = addHuman(game, { level: 1, x: 3000, y: 3000 });
  const bot = addBot(game);
  makeOverLevelBot(bot);
  bot.x = human.x + 300;
  bot.y = human.y;
  game.timeMs = 2000;

  updateBots(game);

  assert.equal(bot.level, 6);
  assert.equal(bot.ai.pendingRecycle, true);
});

test("pending bot recycles after it moves away from humans", () => {
  const game = createGame();
  const human = addHuman(game, { level: 1, x: 3000, y: 3000 });
  const bot = addBot(game);
  makeOverLevelBot(bot);
  bot.ai.pendingRecycle = true;
  bot.x = human.x + 2200;
  bot.y = human.y;
  game.timeMs = 2000;

  updateBots(game);

  assert.equal(bot.level, 1);
  assert.equal(bot.ai.pendingRecycle, false);
});

test("recycled bot expires its old projectiles", () => {
  const game = createGame();
  const bot = addBot(game);
  makeOverLevelBot(bot);
  const projectile = createProjectile({
    id: "bullet-test",
    owner: bot,
    nowMs: game.timeMs,
    config: game.config
  });
  game.projectiles.set(projectile.id, projectile);
  game.timeMs = 2000;

  updateBots(game);

  assert.equal(projectile.state, "expired");
});

test("older in-cap bots decay score instead of growing indefinitely", () => {
  const game = createGame();
  const bot = addBot(game, { level: 3, score: 1000 });
  bot.ai.spawnedAtMs = 0;
  bot.ai.lastGovernedAtMs = 180000;
  game.timeMs = 181000;

  updateBots(game);

  assert.ok(bot.score < 1000);
  assert.ok(bot.score > 990);
  assert.equal(bot.level, 3);
});
