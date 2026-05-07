import test from "node:test";
import assert from "node:assert/strict";
import { SERVER_MESSAGES } from "../shared/protocol/messages.js";
import { ServerGame } from "../server/src/serverGame.js";
import { applyServerMessage, createClientState } from "../client/src/game/clientState.js";
import { deriveDamageEventEffects } from "../client/src/game/effects.js";
import { formatDamageCause } from "../shared/sim/damageSources.js";

test("server queues local damage event with projectile cause", () => {
  const game = new ServerGame({ rng: fixedRng });
  const player = game.createHumanPlayer("client-1", "Bank");
  const source = {
    id: "rocket-1",
    type: "projectile",
    kind: "rocket",
    behavior: "rocket",
    ownerId: "bot-1",
    ownerName: "RocketBot",
    ownerKind: "bot",
    x: player.x - 120,
    y: player.y,
    damage: 25
  };

  game.damageTank(player, source);
  const damageEvent = game.consumeEvents().find((event) => event.type === "damage");

  assert.equal(damageEvent.playerId, player.id);
  assert.equal(damageEvent.cause, "rocket");
  assert.equal(damageEvent.sourceName, "RocketBot");
  assert.equal(damageEvent.amount, 25);
});

test("contact damage events are coalesced but death keeps the killing cause", () => {
  const game = new ServerGame({ rng: fixedRng });
  const player = game.createHumanPlayer("client-1", "Bank");
  const contact = {
    id: "contact-alpha",
    type: "contact",
    kind: "contact",
    behavior: "contact",
    ownerId: "shape-alpha",
    ownerName: "Alpha Pentagon",
    ownerKind: "shape",
    ownerShapeType: "alphaPentagon",
    ownerIsCenterObjective: true,
    x: player.x,
    y: player.y,
    damage: 4
  };

  game.damageTank(player, contact);
  game.damageTank(player, contact);
  const firstEvents = game.consumeEvents().filter((event) => event.type === "damage");
  assert.equal(firstEvents.length, 1);
  assert.equal(firstEvents[0].cause, "alphaContact");

  player.hp = 2;
  game.damageTank(player, { ...contact, damage: 8 });
  const deathEvent = game.consumeEvents().find((event) => event.type === "death");
  assert.equal(deathEvent.deathCause.cause, "alphaContact");
  assert.equal(formatDamageCause(deathEvent.deathCause), "Alpha collision");
});

test("client damage event creates direction indicator and high-impact toast", () => {
  const localTank = { x: 100, y: 80, maxHp: 100, radius: 24 };
  const result = deriveDamageEventEffects({
    amount: 30,
    cause: "trap",
    causeLabel: "trap",
    color: "#7f5af0",
    sourceName: "TrapBot",
    sourceX: 40,
    sourceY: 80,
    targetX: 100,
    targetY: 80
  }, localTank, 1000, 7);

  assert.equal(result.effects[0].type, "damageDirection");
  assert.equal(result.effects[0].angle, 0);
  assert.equal(result.effects[1].type, "damageCauseToast");
  assert.equal(result.effects[1].text, "TrapBot's trap");
  assert.equal(result.nextEffectId, 9);
});

test("client state accepts damage messages without audio spam", () => {
  const state = createClientState();
  state.playerId = "player-1";
  state.latestSnapshot = {
    tanks: [{ id: "player-1", x: 0, y: 0, maxHp: 100, radius: 24 }],
    projectiles: [],
    shapes: []
  };

  const result = applyServerMessage(state, {
    type: SERVER_MESSAGES.DAMAGE,
    amount: 20,
    cause: "bullet",
    causeLabel: "bullet",
    color: "#ffe75c",
    sourceName: "Enemy",
    sourceX: -80,
    sourceY: 0,
    targetX: 0,
    targetY: 0
  }, 1000);

  assert.deepEqual(result.audioEvents, []);
  assert.equal(state.effects.some((effect) => effect.type === "damageDirection"), true);
});

function fixedRng() {
  return 0.5;
}
