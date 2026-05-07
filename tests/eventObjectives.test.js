import test from "node:test";
import assert from "node:assert/strict";
import { EVENT_OBJECTIVE_CONFIG, validateEventObjectiveConfig } from "../shared/config/eventObjectiveConfig.js";
import {
  calculateEventObjectiveRewards,
  chooseEventType,
  completeEventObjective,
  createEventObjectiveRecord,
  createEventObjectiveState,
  expireEventObjective,
  getEventDirectorReadiness,
  getEventMaxActive,
  getEventObjectiveDebug,
  getEventObjectiveSnapshot,
  getEventSpawnCooldownMs,
  getPlayerCountScale,
  isEventDirectorReady,
  recordEventObjectiveHit
} from "../shared/sim/eventObjectives.js";

test("event objective config validates and exposes all planned objectives", () => {
  assert.deepEqual(validateEventObjectiveConfig(EVENT_OBJECTIVE_CONFIG), []);
  assert.deepEqual(Object.keys(EVENT_OBJECTIVE_CONFIG.objectives), [
    "alphaShard",
    "volatileTriangle",
    "bulwarkSquare",
    "beaconPentagon"
  ]);
});

test("director readiness, cooldown, and active cap scale with match progress", () => {
  assert.equal(getEventDirectorReadiness({ highestHumanLevel: 1, matchAgeMs: 0 }), 1 / 45);
  assert.equal(getEventMaxActive(12), 1);
  assert.equal(getEventMaxActive(30), 2);
  assert.ok(getEventSpawnCooldownMs({ highestHumanLevel: 45, matchAgeMs: 360000 }) < getEventSpawnCooldownMs({ highestHumanLevel: 1, matchAgeMs: 0 }));

  const state = createEventObjectiveState();
  assert.equal(isEventDirectorReady({ state, highestHumanLevel: 7, matchAgeMs: 74000, nowMs: 74000 }), false);
  assert.equal(isEventDirectorReady({ state, highestHumanLevel: 8, matchAgeMs: 1000, nowMs: 1000 }), true);
});

test("event type selection respects unlock gates", () => {
  assert.equal(chooseEventType({ highestHumanLevel: 8, matchAgeMs: 75000, rng: () => 0 }).id, "alphaShard");
  assert.equal(chooseEventType({ highestHumanLevel: 15, matchAgeMs: 120000, rng: () => 0.999 }).id, "volatileTriangle");
  assert.equal(chooseEventType({ highestHumanLevel: 45, matchAgeMs: 360000, rng: () => 0.999 }).id, "beaconPentagon");
});

test("event player count scaling is capped and applied to records", () => {
  assert.equal(getPlayerCountScale(1), 1);
  assert.equal(getPlayerCountScale(6), 1.72);
  const event = createEventObjectiveRecord({
    id: "event-1",
    typeId: "bulwarkSquare",
    shapeId: "shape-1",
    x: 100,
    y: 200,
    nowMs: 5000,
    aliveHumans: 4
  });
  assert.equal(event.maxHp, Math.round(EVENT_OBJECTIVE_CONFIG.objectives.bulwarkSquare.hp * 1.54));
  assert.equal(event.expiresAtMs, 5000 + EVENT_OBJECTIVE_CONFIG.objectives.bulwarkSquare.durationMs);
});

test("event contribution rewards split shared pool and last hit bonus", () => {
  const state = createEventObjectiveState();
  const event = createEventObjectiveRecord({
    id: "event-1",
    typeId: "alphaShard",
    shapeId: "shape-1",
    x: 0,
    y: 0,
    nowMs: 0,
    aliveHumans: 1
  });
  state.active.set(event.id, event);
  recordEventObjectiveHit({ state, eventId: event.id, tankId: "tank-a", amount: 300, tankKind: "player" });
  recordEventObjectiveHit({ state, eventId: event.id, tankId: "tank-b", amount: 700, tankKind: "bot" });

  const rewards = calculateEventObjectiveRewards({ event, killerId: "tank-b" });

  assert.equal(rewards.length, 2);
  assert.equal(rewards.find((reward) => reward.tankId === "tank-a").xp, 182);
  assert.equal(rewards.find((reward) => reward.tankId === "tank-b").xp, 577);
  assert.equal(rewards.find((reward) => reward.tankId === "tank-b").lastHitBonusXp, 152);
});

test("event completion archives metrics and recent samples are capped", () => {
  const state = createEventObjectiveState();
  for (let index = 0; index < 10; index += 1) {
    const event = createEventObjectiveRecord({
      id: `event-${index}`,
      typeId: "alphaShard",
      shapeId: `shape-${index}`,
      x: 0,
      y: 0,
      nowMs: index * 1000,
      aliveHumans: 1
    });
    state.active.set(event.id, event);
    recordEventObjectiveHit({ state, eventId: event.id, tankId: "player-1", amount: 460, tankKind: "player" });
    const rewards = calculateEventObjectiveRewards({ event, killerId: "player-1" });
    completeEventObjective({ state, eventId: event.id, killedAtMs: index * 1000 + 5000, killerId: "player-1", killerKind: "player", rewards });
  }

  const debug = getEventObjectiveDebug(state);
  assert.equal(debug.spawned, 0);
  assert.equal(debug.completed, 10);
  assert.equal(debug.recentSamples.length, EVENT_OBJECTIVE_CONFIG.director.recentSampleLimit);
  assert.equal(debug.totalRewardXp, 7600);
  assert.equal(debug.humanShare, 1);
});

test("event expiry removes active event without rewards", () => {
  const state = createEventObjectiveState();
  const event = createEventObjectiveRecord({
    id: "event-1",
    typeId: "volatileTriangle",
    shapeId: "shape-1",
    x: 200,
    y: 300,
    nowMs: 1000,
    aliveHumans: 1
  });
  state.active.set(event.id, event);
  recordEventObjectiveHit({ state, eventId: event.id, tankId: "player-1", amount: 120, tankKind: "player" });

  const sample = expireEventObjective({ state, eventId: event.id, expiredAtMs: 62000 });
  const debug = getEventObjectiveDebug(state);

  assert.equal(sample.outcome, "expired");
  assert.equal(debug.expired, 1);
  assert.equal(debug.totalRewardXp, 0);
  assert.equal(state.active.size, 0);
});

test("event snapshot is bounded and player-facing", () => {
  const event = createEventObjectiveRecord({
    id: "event-1",
    typeId: "beaconPentagon",
    shapeId: "shape-1",
    x: 1200.111,
    y: 1800.222,
    nowMs: 1000,
    aliveHumans: 1
  });
  const snapshot = getEventObjectiveSnapshot({
    event,
    shape: { id: "shape-1", state: "alive", x: 1200.111, y: 1800.222, hp: 340, maxHp: 680, radius: 60 },
    nowMs: 2000
  });

  assert.equal(snapshot.typeId, "beaconPentagon");
  assert.equal(snapshot.label, "Beacon Pentagon");
  assert.equal(snapshot.hpRatio, 0.5);
  assert.equal(snapshot.expiresInMs, EVENT_OBJECTIVE_CONFIG.objectives.beaconPentagon.durationMs - 1000);
  assert.equal(snapshot.ui.color, EVENT_OBJECTIVE_CONFIG.objectives.beaconPentagon.ui.color);
});
