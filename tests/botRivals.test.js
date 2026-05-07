import test from "node:test";
import assert from "node:assert/strict";
import { BOT_PROFILE_CONFIG, validateBotProfileConfig } from "../shared/config/botProfileConfig.js";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";
import { coinsForTankKill } from "../shared/sim/economy.js";
import { createTank } from "../shared/sim/entityFactory.js";
import { xpRewardForTankKill } from "../shared/sim/progression.js";
import {
  BOT_RIVAL_TIERS,
  canClaimBotBounty,
  clearBotRivalState,
  createBotRivalState,
  getBotBountyReward,
  getBotRivalDebug,
  getBotRivalSnapshots,
  getBotRivalTier,
  markBotBountyClaimed,
  recordBotRivalDamageMemory,
  recordBotRivalKill
} from "../shared/sim/botRivals.js";
import { ServerGame } from "../server/src/serverGame.js";

function createTestConfig() {
  const config = JSON.parse(JSON.stringify(GAME_CONFIG));
  config.shapes.targetCount = 0;
  config.bots.baseCount = 0;
  config.bots.perHuman = 0;
  config.bots.maxCount = 0;
  return config;
}

function createGame() {
  return new ServerGame({ config: createTestConfig(), rng: () => 0.5 });
}

function createBot(overrides = {}) {
  const bot = createTank({
    id: overrides.id ?? "bot-rival",
    name: overrides.name ?? "Duelist Byte-01",
    x: overrides.x ?? 1000,
    y: overrides.y ?? 1000,
    color: "#ff5",
    kind: "bot",
    nowMs: 0,
    config: GAME_CONFIG
  });
  Object.assign(bot, {
    level: 15,
    score: 0,
    hp: bot.maxHp,
    state: "alive",
    ...overrides
  });
  bot.ai ??= {};
  bot.ai.rival ??= createBotRivalState(0);
  return bot;
}

test("bot rival config validates with bounded reward rules", () => {
  assert.deepEqual(validateBotProfileConfig(BOT_PROFILE_CONFIG), []);
  assert.equal(BOT_PROFILE_CONFIG.rivals.minLevel, 15);
  assert.ok(BOT_PROFILE_CONFIG.rivals.bounty.maxCoins <= 18);
});

test("bot rival tier only activates after configured level and pressure thresholds", () => {
  const tooLow = createBot({ level: 14 });
  recordBotRivalKill(tooLow, { id: "victim", kind: "player" }, 1000);
  recordBotRivalKill(tooLow, { id: "victim-2", kind: "player" }, 1100);
  assert.equal(getBotRivalTier(tooLow), BOT_RIVAL_TIERS.NONE);

  const rival = createBot({ level: 15 });
  recordBotRivalKill(rival, { id: "victim", kind: "bot" }, 1000);
  assert.equal(getBotRivalTier(rival), BOT_RIVAL_TIERS.RIVAL);

  const threat = createBot({ level: 15, score: BOT_PROFILE_CONFIG.rivals.threatScoreThreshold });
  assert.equal(getBotRivalTier(threat), BOT_RIVAL_TIERS.THREAT);

  const bounty = createBot({ level: 15 });
  recordBotRivalKill(bounty, { id: "victim", kind: "bot" }, 1000);
  recordBotRivalKill(bounty, { id: "victim-2", kind: "player" }, 1100);
  assert.equal(getBotRivalTier(bounty), BOT_RIVAL_TIERS.BOUNTY);
});

test("bot bounty rewards are bounded and paid once", () => {
  const killer = { id: "player-1", kind: "player" };
  const bot = createBot({ level: 45, score: 4000 });
  recordBotRivalKill(bot, { id: "victim", kind: "bot" }, 1000);
  recordBotRivalKill(bot, { id: "victim-2", kind: "bot" }, 1100);

  const reward = getBotBountyReward(bot);
  assert.ok(reward.coins >= BOT_PROFILE_CONFIG.rivals.bounty.minCoins);
  assert.ok(reward.coins <= BOT_PROFILE_CONFIG.rivals.bounty.maxCoins);
  assert.equal(canClaimBotBounty({ bot, killer, recentClaims: [], nowMs: 1200 }).allowed, true);

  markBotBountyClaimed(bot, 1200);
  assert.equal(getBotBountyReward(bot).coins, 0);
  assert.equal(canClaimBotBounty({ bot, killer, recentClaims: [], nowMs: 1300 }).allowed, false);
});

test("anti-farm rule blocks repeated bounty claims inside the claim window", () => {
  const killer = { id: "player-1", kind: "player" };
  const bot = createBot({ level: 30, score: 3000 });
  const recentClaims = [
    { killerId: killer.id, atMs: 1000 },
    { killerId: killer.id, atMs: 2000 }
  ];

  assert.equal(canClaimBotBounty({
    bot,
    killer,
    recentClaims,
    nowMs: 3000
  }).reason, "anti-farm");
});

test("server awards one bounded bounty bonus when a player kills a bounty bot", () => {
  const game = createGame();
  const player = game.createHumanPlayer("client-1", "Bank");
  const bot = createBot({ id: "bot-bounty", level: 30, score: 3000, x: player.x + 200, y: player.y });
  recordBotRivalKill(bot, { id: "victim", kind: "bot" }, 1000);
  recordBotRivalKill(bot, { id: "victim-2", kind: "player" }, 1100);
  game.tanks.set(bot.id, bot);

  const baseXp = xpRewardForTankKill(bot, game.config);
  const baseCoins = coinsForTankKill(bot, game.appConfig);
  const bounty = getBotBountyReward(bot);
  game.damageTank(bot, {
    ownerId: player.id,
    ownerName: player.name,
    ownerKind: player.kind,
    kind: "bullet",
    damage: bot.hp + 10
  });

  assert.equal(player.score, baseXp + bounty.score);
  assert.equal(player.matchCoinsEarned, baseCoins + bounty.coins);
  assert.equal(bot.ai.rival.tier, BOT_RIVAL_TIERS.NONE);
  assert.equal(game.pendingEvents.filter((event) => event.type === "botBounty").length, 1);
  assert.equal(game.pendingEvents.filter((event) => event.source === "botBounty").length, 1);
});

test("server anti-farm state prevents extra bounty payout for same player", () => {
  const game = createGame();
  const player = game.createHumanPlayer("client-1", "Bank");
  const bot = createBot({ id: "bot-bounty", level: 30, score: 3000 });
  game.botBountyClaims = [
    { killerId: player.id, atMs: 1000 },
    { killerId: player.id, atMs: 2000 }
  ];
  game.timeMs = 3000;

  assert.equal(game.claimBotBountyIfEligible(player, bot), null);
  assert.equal(game.pendingEvents.some((event) => event.type === "botBounty"), false);
});

test("rival damage memory creates a temporary revenge target and debug counts are finite", () => {
  const bot = createBot({ level: 20 });
  recordBotRivalDamageMemory(bot, "player-1", 1000);
  const snapshot = getBotRivalSnapshots([bot], 1000)[0];
  const debug = getBotRivalDebug([bot], 1000, []);

  assert.equal(snapshot.revengeTargetId, "player-1");
  assert.equal(Number.isFinite(debug.active), true);

  clearBotRivalState(bot, 1200);
  assert.equal(getBotRivalSnapshots([bot], 1200).length, 0);
});
