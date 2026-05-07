import test from "node:test";
import assert from "node:assert/strict";
import { ServerGame } from "../server/src/serverGame.js";
import { WORLD_CONTENT_CONFIG, validateWorldContentConfig } from "../shared/config/worldContentConfig.js";
import {
  calculateCenterObjectiveRewards,
  completeCenterObjectiveMetrics,
  createCenterObjectiveState,
  getCenterObjectiveMetricsSnapshot,
  getCenterBlockedZones,
  getWorldCenter,
  isInsideBlockedZone,
  recordCenterObjectiveDamage,
  resetCenterObjectiveLifeMetrics
} from "../shared/sim/centerObjective.js";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";

function createTestConfig() {
  const config = JSON.parse(JSON.stringify(GAME_CONFIG));
  config.shapes.targetCount = 0;
  config.bots.baseCount = 0;
  config.bots.perHuman = 0;
  return config;
}

test("world content config validates and center point matches larger world", () => {
  assert.deepEqual(validateWorldContentConfig(WORLD_CONTENT_CONFIG), []);
  assert.deepEqual(getWorldCenter(GAME_CONFIG.world), { x: 4500, y: 4500 });
});

test("center blocked zones reject overlapping spawn candidates", () => {
  const zones = getCenterBlockedZones(GAME_CONFIG);
  assert.equal(isInsideBlockedZone({ x: 4500, y: 4500, radius: 22 }, zones), true);
  assert.equal(isInsideBlockedZone({ x: 900, y: 900, radius: 22 }, zones), false);
});

test("center objective spawns once at world center", () => {
  const game = new ServerGame({ config: createTestConfig(), rng: () => 0.1 });
  const objective = game.getCenterObjectiveDebugState();

  assert.equal(objective.state, "alive");
  assert.equal(objective.shapeType, "alphaPentagon");
  assert.equal(objective.x, 4500);
  assert.equal(objective.y, 4500);
  assert.equal(objective.maxHp, 1400);
  assert.equal([...game.shapes.values()].filter((shape) => shape.isCenterObjective).length, 1);
});

test("center objective rewards split by contribution and last hit bonus", () => {
  const state = createCenterObjectiveState();
  recordCenterObjectiveDamage(state, "tank-a", 700);
  recordCenterObjectiveDamage(state, "tank-b", 700);

  const rewards = calculateCenterObjectiveRewards({
    contributors: state.contributors,
    killerId: "tank-b"
  });

  assert.equal(rewards.length, 2);
  assert.equal(rewards.find((reward) => reward.tankId === "tank-a").xp, 1785);
  assert.equal(rewards.find((reward) => reward.tankId === "tank-b").xp, 2415);
  assert.equal(rewards.find((reward) => reward.tankId === "tank-a").coins, 40);
  assert.equal(rewards.find((reward) => reward.tankId === "tank-b").coins, 40);
});

test("center objective metrics record human and bot damage for the current life", () => {
  const state = createCenterObjectiveState();
  resetCenterObjectiveLifeMetrics(state, 250);
  recordCenterObjectiveDamage(state, "human-1", 300, "player");
  recordCenterObjectiveDamage(state, "bot-1", 120, "bot");
  recordCenterObjectiveDamage(state, "human-1", 80, "player");

  const metrics = getCenterObjectiveMetricsSnapshot(state);
  assert.equal(metrics.spawnedAtMs, 250);
  assert.equal(metrics.totalDamage, 500);
  assert.equal(metrics.humanDamage, 380);
  assert.equal(metrics.botDamage, 120);
  assert.equal(metrics.contributorsPeak, 2);
});

test("center objective metrics record kill summary and recent samples", () => {
  const state = createCenterObjectiveState();
  resetCenterObjectiveLifeMetrics(state, 1000);
  recordCenterObjectiveDamage(state, "human-1", 900, "player");
  recordCenterObjectiveDamage(state, "bot-1", 500, "bot");
  const rewards = [
    { tankId: "human-1", xp: 3000, coins: 60 },
    { tankId: "bot-1", xp: 1000, coins: 0 }
  ];

  const sample = completeCenterObjectiveMetrics(state, {
    killedAtMs: 6400,
    rewards,
    killerKind: "player"
  });
  const metrics = getCenterObjectiveMetricsSnapshot(state);

  assert.equal(sample.lifeMs, 5400);
  assert.equal(metrics.kills, 1);
  assert.equal(metrics.lastLifeMs, 5400);
  assert.equal(metrics.lastContributors, 2);
  assert.equal(metrics.lastHumanDamage, 900);
  assert.equal(metrics.lastBotDamage, 500);
  assert.equal(metrics.lastRewardXp, 4000);
  assert.equal(metrics.lastRewardCoins, 60);
  assert.equal(metrics.lastKillerKind, "player");
  assert.equal(metrics.recentKills.length, 1);
});

test("destroying alpha grants XP once and starts respawn timer", () => {
  const game = new ServerGame({ config: createTestConfig(), rng: () => 0.1 });
  const tank = game.createHumanPlayer("client-a", "Bank");
  const shape = [...game.shapes.values()].find((candidate) => candidate.isCenterObjective);
  const projectile = {
    ownerId: tank.id,
    ownerName: tank.name,
    damage: shape.hp + 10
  };

  game.damageShape(shape, projectile);
  const levelAfterFirstKill = tank.level;
  const scoreAfterFirstKill = tank.score;
  game.damageShape(shape, projectile);

  assert.equal(game.getCenterObjectiveDebugState().state, "down");
  assert.equal(game.getCenterObjectiveDebugState().respawnInMs, 45000);
  assert.equal(game.getCenterObjectiveDebugState().metrics.kills, 1);
  assert.equal(game.getCenterObjectiveDebugState().metrics.lastKillerKind, "player");
  assert.equal(game.getCenterObjectiveDebugState().metrics.lastContributors, 1);
  assert.ok(levelAfterFirstKill > 1);
  assert.equal(tank.score, scoreAfterFirstKill);

  game.step(45);
  assert.equal(game.getCenterObjectiveDebugState().state, "alive");
});
