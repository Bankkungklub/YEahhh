import test from "node:test";
import assert from "node:assert/strict";
import { BOT_PROFILE_CONFIG, validateBotProfileConfig } from "../shared/config/botProfileConfig.js";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";
import {
  applyProfileToBot,
  chooseBotProfile,
  getBotProfile,
  getBotProfileDebugCounts
} from "../shared/sim/botProfiles.js";
import {
  applyBotMistake,
  chooseBotGoal,
  getBotBehaviorDebugCounts,
  getBotClassDebugCounts,
  recordBotDamageMemory,
  scoreDroneTarget,
  scoreEnemyTarget,
  scoreShapeTarget,
  shouldSwitchTarget,
  updateBotIntent,
  updateBots
} from "../server/src/botController.js";

function makeBot(profileId, overrides = {}) {
  return {
    id: `bot-${profileId}`,
    type: "tank",
    kind: "bot",
    state: "alive",
    x: 1000,
    y: 1000,
    hp: 100,
    maxHp: 100,
    radius: 22,
    ai: { profileId },
    input: { moveX: 0, moveY: 0, aimAngle: 0, fire: false },
    ...overrides
  };
}

test("bot profile config validates and weighted selection covers all profiles", () => {
  assert.deepEqual(validateBotProfileConfig(BOT_PROFILE_CONFIG), []);
  assert.equal(chooseBotProfile(() => 0.01), "rookie");
  assert.equal(chooseBotProfile(() => 0.41), "farmer");
  assert.equal(chooseBotProfile(() => 0.7), "duelist");
  assert.equal(chooseBotProfile(() => 0.85), "sniper");
  assert.equal(chooseBotProfile(() => 0.95), "pro");
});

test("profile application falls back safely and debug counts profiles", () => {
  const bot = makeBot("missing");
  const profile = applyProfileToBot(bot, "missing");

  assert.equal(profile.id, "rookie");
  assert.equal(bot.ai.profileId, "rookie");
  assert.deepEqual(getBotProfileDebugCounts([
    bot,
    makeBot("pro"),
    { kind: "player" }
  ]), {
    rookie: 1,
    farmer: 0,
    duelist: 0,
    sniper: 0,
    pro: 1
  });
});

test("profile scoring makes farmers value shapes and duelists value wounded enemies", () => {
  const bot = makeBot("farmer");
  const shape = { id: "shape", type: "shape", x: 1120, y: 1000, xp: 70, radius: 38, state: "alive" };
  const safeEnemy = { id: "enemy-safe", type: "tank", x: 1800, y: 1000, hp: 100, maxHp: 100, radius: 22, state: "alive" };
  const woundedEnemy = { id: "enemy-wounded", type: "tank", x: 1180, y: 1000, hp: 20, maxHp: 100, radius: 22, state: "alive" };

  assert.ok(scoreShapeTarget(bot, shape, getBotProfile("farmer")) > scoreEnemyTarget(bot, safeEnemy, getBotProfile("farmer")));
  assert.ok(scoreEnemyTarget(bot, woundedEnemy, getBotProfile("duelist")) > scoreShapeTarget(bot, shape, getBotProfile("duelist")));
});

test("event objective scoring uses profile bias, HP confidence, and human dampener", () => {
  const eventShape = {
    id: "event-shape",
    type: "shape",
    isEventObjective: true,
    eventBotInterestMultiplier: 1,
    x: 1120,
    y: 1000,
    xp: 760,
    radius: 52,
    state: "alive"
  };
  const farmer = makeBot("farmer");
  const rookie = makeBot("rookie");
  const lowHpFarmer = makeBot("farmer", { hp: 10, maxHp: 100 });
  const gameWithoutHumanNearby = {
    tanks: new Map([[farmer.id, farmer]]),
    timeMs: 1000
  };
  const gameWithHumanNearby = {
    tanks: new Map([[farmer.id, farmer], ["human", { id: "human", kind: "player", state: "alive", disconnectedAtMs: null, x: 1130, y: 1000 }]]),
    timeMs: 1000
  };

  const farmerScore = scoreShapeTarget(farmer, eventShape, getBotProfile("farmer"), gameWithoutHumanNearby);
  const rookieScore = scoreShapeTarget(rookie, eventShape, getBotProfile("rookie"), gameWithoutHumanNearby);
  const dampenedScore = scoreShapeTarget(farmer, eventShape, getBotProfile("farmer"), gameWithHumanNearby);

  assert.ok(farmerScore > rookieScore);
  assert.equal(scoreShapeTarget(lowHpFarmer, eventShape, getBotProfile("farmer"), gameWithoutHumanNearby), 0);
  assert.ok(dampenedScore < farmerScore);
});

test("bots mark sector events as contestEvent targets", () => {
  const bot = makeBot("farmer");
  const eventShape = {
    id: "event-shape",
    type: "shape",
    isEventObjective: true,
    eventBotInterestMultiplier: 1,
    x: 1120,
    y: 1000,
    xp: 760,
    radius: 52,
    state: "alive"
  };
  const game = {
    config: GAME_CONFIG,
    timeMs: 1000,
    tanks: new Map([[bot.id, bot]]),
    shapes: new Map([[eventShape.id, eventShape]]),
    rng: () => 0.5,
    spatialIndex: null,
    performanceStats: { aiCandidateChecks: 0 },
    isTankInvulnerable: () => false
  };

  updateBotIntent(game, bot);

  assert.equal(bot.ai.mode, "contestEvent");
  assert.equal(bot.ai.targetKind, "event");
  assert.equal(bot.ai.targetId, eventShape.id);
  assert.equal(bot.input.fire, true);
});

test("bots can target exposed enemy drones at low priority", () => {
  const bot = makeBot("duelist");
  const drone = {
    id: "drone-1",
    type: "drone",
    kind: "drone",
    ownerId: "human",
    state: "active",
    x: 1120,
    y: 1000,
    hp: 8,
    maxHp: 26,
    radius: 12,
    vx: 0,
    vy: 0
  };
  const owner = { id: "human", kind: "player", state: "alive", x: 4000, y: 1000 };
  const profile = getBotProfile("duelist");
  const game = {
    config: GAME_CONFIG,
    timeMs: 1000,
    tanks: new Map([[bot.id, bot], [owner.id, owner]]),
    shapes: new Map(),
    drones: new Map([[drone.id, drone]]),
    rng: () => 0.5,
    spatialIndex: null,
    performanceStats: { aiCandidateChecks: 0 },
    isTankInvulnerable: () => false
  };

  assert.ok(scoreDroneTarget(bot, drone, profile) > 0);
  updateBotIntent(game, bot);

  assert.equal(bot.ai.mode, "antiDrone");
  assert.equal(bot.ai.targetKind, "drone");
  assert.equal(bot.ai.targetId, drone.id);
  assert.equal(bot.input.fire, true);
});

test("bot damage memory creates panic and revenge scoring", () => {
  const bot = makeBot("duelist", { hp: 60, maxHp: 100 });
  const attacker = { id: "attacker", type: "tank", kind: "player", x: 1200, y: 1000, hp: 100, maxHp: 100, radius: 22, state: "alive" };
  const bystander = { id: "bystander", type: "tank", kind: "player", x: 1200, y: 1020, hp: 100, maxHp: 100, radius: 22, state: "alive" };
  const game = {
    timeMs: 1000,
    tanks: new Map([[bot.id, bot], [attacker.id, attacker], [bystander.id, bystander]]),
    shapes: new Map(),
    config: GAME_CONFIG,
    rng: () => 0.5,
    isTankInvulnerable: () => false
  };

  recordBotDamageMemory(game, bot, { ownerId: attacker.id }, 45);

  assert.equal(bot.ai.lastDamagedById, attacker.id);
  assert.ok(bot.ai.panicUntilMs > game.timeMs);
  assert.ok(scoreEnemyTarget(bot, attacker, getBotProfile("duelist"), game.timeMs) > scoreEnemyTarget(bot, bystander, getBotProfile("duelist"), game.timeMs));
});

test("target stickiness requires a stronger replacement before switching", () => {
  const profile = getBotProfile("pro");
  const bot = makeBot("pro");

  assert.equal(shouldSwitchTarget(bot, 10, 12, profile), false);
  assert.equal(shouldSwitchTarget(bot, 10, 14, profile), true);
});

test("chooseBotGoal respects committed targets until hysteresis is beaten", () => {
  const profile = getBotProfile("pro");
  const bot = makeBot("pro");
  const current = { id: "current", type: "shape", x: 1060, y: 1000, xp: 35, radius: 20, state: "alive" };
  const next = { id: "next", type: "shape", x: 1080, y: 1000, xp: 40, radius: 20, state: "alive" };
  const game = {
    timeMs: 1000,
    tanks: new Map([[bot.id, bot]]),
    shapes: new Map([[current.id, current], [next.id, next]])
  };
  bot.ai.targetId = current.id;
  bot.ai.targetKind = "shape";
  bot.ai.targetStickUntilMs = 2000;

  const goal = chooseBotGoal(game, bot, null, next, profile);

  assert.equal(goal.entity.id, current.id);
});

test("profile-driven intents make rookies retreat earlier while pros keep fighting", () => {
  const enemy = { id: "enemy", type: "tank", kind: "player", state: "alive", x: 1200, y: 1000, hp: 100, maxHp: 100, radius: 22 };
  const createGame = (bot) => ({
    config: GAME_CONFIG,
    timeMs: 1000,
    tanks: new Map([[bot.id, bot], [enemy.id, enemy]]),
    shapes: new Map(),
    rng: () => 0.5,
    isTankInvulnerable: () => false
  });

  const rookie = makeBot("rookie", { hp: 35 });
  updateBotIntent(createGame(rookie), rookie);
  assert.equal(rookie.ai.mode, "retreat");

  const pro = makeBot("pro", { hp: 35 });
  updateBotIntent(createGame(pro), pro);
  assert.equal(pro.ai.mode, "chaseEnemy");
});

test("sniper aim lead changes aim angle for moving targets", () => {
  const enemy = {
    id: "enemy",
    type: "tank",
    kind: "player",
    state: "alive",
    x: 1600,
    y: 1000,
    vx: 0,
    vy: 220,
    hp: 100,
    maxHp: 100,
    radius: 22
  };
  const sniper = makeBot("sniper", {
    level: 15,
    classId: "sniper",
    classHistory: ["basic", "sniper"],
    upgrades: {
      maxHealth: 0,
      regen: 0,
      bulletDamage: 0,
      bulletSpeed: 0,
      reload: 0,
      moveSpeed: 0
    }
  });
  const game = {
    config: GAME_CONFIG,
    timeMs: 1000,
    tanks: new Map([[sniper.id, sniper], [enemy.id, enemy]]),
    shapes: new Map(),
    rng: () => 0.5,
    isTankInvulnerable: () => false
  };

  updateBotIntent(game, sniper);

  assert.equal(sniper.ai.mode, "chaseEnemy");
  assert.ok(sniper.input.aimAngle > 0);
});

test("bot mistakes are rate-limited and can suppress fire", () => {
  const bot = makeBot("rookie", { input: { moveX: 1, moveY: 0, aimAngle: 0, fire: true } });
  const values = [0.01, 0.2];
  const game = {
    timeMs: 1000,
    rng: () => values.shift() ?? 0.5
  };

  applyBotMistake(game, bot, getBotProfile("rookie"));

  assert.equal(bot.input.fire, false);
  assert.ok(bot.ai.mistakeUntilMs > game.timeMs);
});

test("profile preferences select valid deep tree classes and debug class counts", () => {
  const bot = makeBot("sniper", {
    level: 45,
    classId: "sniper",
    classHistory: ["basic", "sniper"],
    upgradePoints: 0,
    upgrades: {
      maxHealth: 0,
      regen: 0,
      bulletDamage: 0,
      bulletSpeed: 0,
      reload: 0,
      moveSpeed: 0
    },
    score: 0,
    xp: 0,
    color: "#fff",
    spawnedAtMs: 0,
    respawnAtMs: 0,
    fireCooldownMs: 0,
    lastDamageAtMs: -Infinity
  });
  const game = {
    config: GAME_CONFIG,
    timeMs: 1000,
    tanks: new Map([[bot.id, bot]]),
    shapes: new Map(),
    projectiles: new Map(),
    rng: () => 0.5,
    spatialIndex: null,
    performanceStats: { aiCandidateChecks: 0 },
    isTankInvulnerable: () => false,
    respawnTank: () => {}
  };

  updateBots(game);
  assert.equal(bot.classId, "hunter");
  updateBots(game);
  assert.equal(bot.classId, "predator");
  assert.deepEqual(getBotClassDebugCounts(game), { predator: 1 });
});

test("bot behavior debug reports modes, targets, panic, and revenge", () => {
  const revengeBot = makeBot("duelist", {
    ai: {
      profileId: "duelist",
      mode: "chaseEnemy",
      targetId: "attacker",
      targetKind: "tank",
      recentAttackers: { attacker: 3000 },
      panicUntilMs: 0
    }
  });
  const panicBot = makeBot("rookie", {
    ai: {
      profileId: "rookie",
      mode: "retreat",
      targetKind: "tank",
      panicUntilMs: 3000
    }
  });
  const game = {
    timeMs: 1000,
    tanks: new Map([[revengeBot.id, revengeBot], [panicBot.id, panicBot]])
  };

  assert.deepEqual(getBotBehaviorDebugCounts(game), {
    modes: { chaseEnemy: 1, retreat: 1 },
    targetKinds: { tank: 2 },
    panic: 1,
    revenge: 1
  });
});
