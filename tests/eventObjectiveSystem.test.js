import test from "node:test";
import assert from "node:assert/strict";
import { ServerGame } from "../server/src/serverGame.js";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";
import { EVENT_OBJECTIVE_CONFIG } from "../shared/config/eventObjectiveConfig.js";

function createTestConfig() {
  const config = JSON.parse(JSON.stringify(GAME_CONFIG));
  config.shapes.targetCount = 0;
  config.bots.baseCount = 0;
  config.bots.perHuman = 0;
  return config;
}

function createGame(rngValues = [0.1]) {
  const values = [...rngValues];
  return new ServerGame({
    config: createTestConfig(),
    rng: () => values.shift() ?? 0.5
  });
}

function addHuman(game, overrides = {}) {
  const tank = game.createHumanPlayer("client-1", "Bank");
  Object.assign(tank, overrides);
  return tank;
}

function getEventShape(game) {
  return [...game.shapes.values()].find((shape) => shape.isEventObjective);
}

test("event objective spawns from level gate without counting as a normal shape", () => {
  const game = createGame([0, 0, 0.5, 0.5]);
  addHuman(game, { level: EVENT_OBJECTIVE_CONFIG.director.firstUnlockLevel });

  game.step(1 / game.config.server.tickRate);
  const eventShape = getEventShape(game);
  const snapshot = game.createSnapshot();

  assert.ok(eventShape);
  assert.equal(eventShape.eventType, "alphaShard");
  assert.equal(snapshot.eventObjectives.length, 1);
  assert.equal(snapshot.counts.shapes, 2); // Alpha center plus the sector event.
  assert.equal([...game.shapes.values()].filter((shape) => !shape.isCenterObjective && !shape.isEventObjective).length, 0);
});

test("destroying event objective rewards contributors exactly once", () => {
  const game = createGame([0, 0, 0.5, 0.5]);
  const tank = addHuman(game, { level: 8 });
  game.step(1 / game.config.server.tickRate);
  const eventShape = getEventShape(game);
  const projectile = {
    ownerId: tank.id,
    ownerName: tank.name,
    ownerKind: tank.kind,
    damage: eventShape.hp + 20,
    kind: "bullet",
    behavior: "bullet"
  };

  game.damageShape(eventShape, projectile);
  const scoreAfterFirstKill = tank.score;
  game.damageShape(eventShape, projectile);
  const debug = game.getEventObjectiveDebugState();

  assert.equal(debug.completed, 1);
  assert.equal(debug.totalRewardXp, EVENT_OBJECTIVE_CONFIG.objectives.alphaShard.rewardXp);
  assert.equal(scoreAfterFirstKill, EVENT_OBJECTIVE_CONFIG.objectives.alphaShard.scoreReward);
  assert.equal(tank.score, scoreAfterFirstKill);
  assert.equal(game.shapes.has(eventShape.id), false);
});

test("expired event objective deletes its shape without reward", () => {
  const game = createGame([0, 0, 0.5, 0.5]);
  const tank = addHuman(game, { level: 8 });
  game.step(1 / game.config.server.tickRate);
  const eventShape = getEventShape(game);
  game.timeMs = eventShape.eventExpiresAtMs + 1;

  game.step(1 / game.config.server.tickRate);
  const debug = game.getEventObjectiveDebugState();

  assert.equal(debug.expired, 1);
  assert.equal(debug.totalRewardXp, 0);
  assert.equal(tank.score, 0);
  assert.equal(game.shapes.has(eventShape.id), false);
});

test("event active cap allows two late objectives but not a third", () => {
  const game = createGame([0.99, 0, 0.2, 0.35, 0, 0.3, 0.75, 0, 0.4]);
  addHuman(game, { level: 45 });

  game.step(1 / game.config.server.tickRate);
  game.eventObjectives.nextSpawnAtMs = game.timeMs;
  game.step(1 / game.config.server.tickRate);
  game.eventObjectives.nextSpawnAtMs = game.timeMs;
  game.step(1 / game.config.server.tickRate);

  assert.equal(game.getEventObjectiveDebugState().activeCount, 2);
});

test("bulwark event uses incoming damage resistance", () => {
  const game = createGame([0.5, 0.5]);
  const tank = addHuman(game, { level: 45 });
  game.rng = () => 0.8;
  game.step(1 / game.config.server.tickRate);
  const eventShape = getEventShape(game);

  assert.equal(eventShape.eventType, "bulwarkSquare");
  const hpBefore = eventShape.hp;
  game.damageShape(eventShape, {
    ownerId: tank.id,
    ownerName: tank.name,
    ownerKind: tank.kind,
    damage: 100,
    kind: "bullet",
    behavior: "bullet"
  });

  assert.equal(Math.round(hpBefore - eventShape.hp), 85);
});

test("volatile event creates neutral spark burst that cannot damage shapes", () => {
  const game = createGame([0.5, 0.5]);
  const tank = addHuman(game, { level: 45 });
  game.rng = () => 0.5;
  game.step(1 / game.config.server.tickRate);
  const eventShape = getEventShape(game);

  assert.equal(eventShape.eventType, "volatileTriangle");
  game.damageShape(eventShape, {
    ownerId: tank.id,
    ownerName: tank.name,
    ownerKind: tank.kind,
    damage: eventShape.hp + 10,
    kind: "bullet",
    behavior: "bullet"
  });

  const sparks = [...game.projectiles.values()].filter((projectile) => projectile.ownerKind === "eventObjective");
  assert.equal(sparks.length, EVENT_OBJECTIVE_CONFIG.objectives.volatileTriangle.deathBurst.count);
  assert.equal(sparks.every((projectile) => projectile.kind === "spark"), true);
  assert.equal(sparks.every((projectile) => projectile.hitsShapes === false), true);
});
