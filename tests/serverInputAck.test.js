import test from "node:test";
import assert from "node:assert/strict";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";
import { ServerGame } from "../server/src/serverGame.js";

function createTestConfig() {
  const config = JSON.parse(JSON.stringify(GAME_CONFIG));
  config.shapes.targetCount = 0;
  config.bots.baseCount = 0;
  config.bots.perHuman = 0;
  return config;
}

test("server snapshot acknowledges the latest processed player input sequence", () => {
  const game = new ServerGame({ config: createTestConfig(), rng: () => 0.5 });
  const player = game.createHumanPlayer("client-1", "Bank");

  assert.equal(game.receiveInput(player.id, {
    seq: 5,
    moveX: 1,
    moveY: 0,
    aimAngle: 0,
    fire: false
  }), true);

  const tank = game.createSnapshot().tanks.find((candidate) => candidate.id === player.id);
  assert.equal(tank.lastInputSeq, 5);
});

test("server ignores older input sequences instead of rewinding movement", () => {
  const game = new ServerGame({ config: createTestConfig(), rng: () => 0.5 });
  const player = game.createHumanPlayer("client-1", "Bank");

  game.receiveInput(player.id, {
    seq: 5,
    moveX: 1,
    moveY: 0,
    aimAngle: 0,
    fire: false
  });
  assert.equal(game.receiveInput(player.id, {
    seq: 4,
    moveX: -1,
    moveY: 0,
    aimAngle: 0,
    fire: false
  }), false);

  assert.equal(player.input.seq, 5);
  assert.equal(player.input.moveX, 1);
});
