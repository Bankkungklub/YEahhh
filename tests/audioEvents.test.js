import test from "node:test";
import assert from "node:assert/strict";
import { AUDIO_CONFIG } from "../client/src/audio/audioConfig.js";
import { deriveAudioEvents, createAudioEventLimiter, getAudioProfileForFireEvent } from "../client/src/audio/audioEvents.js";

test("first snapshot creates no audio burst", () => {
  const next = createSnapshot();
  const events = deriveAudioEvents({
    previousSnapshot: null,
    nextSnapshot: next,
    playerId: "player-1",
    visualEffects: [{ type: "damageText", targetType: "shape" }],
    nowMs: 1000
  });
  assert.equal(events.length, 0);
});

test("local projectile creation emits one grouped fire event", () => {
  const previous = createSnapshot({ projectiles: [] });
  const next = createSnapshot({
    projectiles: [
      { id: "bullet-1", ownerId: "player-1", x: 110, y: 100, feedbackProfile: "storm" },
      { id: "bullet-2", ownerId: "player-1", x: 112, y: 102, feedbackProfile: "storm" },
      { id: "bullet-3", ownerId: "bot-1", x: 300, y: 300 }
    ]
  });
  const events = deriveAudioEvents({
    previousSnapshot: previous,
    nextSnapshot: next,
    playerId: "player-1",
    nowMs: 1200
  });
  const fire = events.filter((event) => event.role === "fire");
  assert.equal(fire.length, 1);
  assert.equal(fire[0].count, 2);
  assert.equal(fire[0].feedbackProfile, "storm");
  assert.equal(fire[0].gain, AUDIO_CONFIG.sfxRules.feedbackProfiles.storm.gainMultiplier);
  assert.equal(fire[0].pitchScale, AUDIO_CONFIG.sfxRules.feedbackProfiles.storm.pitchMultiplier);
});

test("visual feedback maps to hit, level, and upgrade sounds", () => {
  const previous = createSnapshot();
  const next = createSnapshot();
  const events = deriveAudioEvents({
    previousSnapshot: previous,
    nextSnapshot: next,
    playerId: "player-1",
    visualEffects: [
      { type: "damageText", targetType: "shape", x: 120, y: 100 },
      { type: "damageText", targetType: "tank", x: 160, y: 100 },
      { type: "levelToast" },
      { type: "upgradeReady" }
    ],
    nowMs: 1500
  });
  assert.ok(events.some((event) => event.role === "hitShape"));
  assert.ok(events.some((event) => event.role === "hitTank"));
  assert.ok(events.some((event) => event.role === "levelUp"));
  assert.ok(events.some((event) => event.role === "upgradeReady"));
});

test("destroyed targets and death messages emit one-shot sounds", () => {
  const previous = createSnapshot({
    shapes: [
      { id: "shape-1", shapeType: "square", x: 130, y: 100 },
      { id: "alpha-1", shapeType: "alphaPentagon", isCenterObjective: true, x: 4500, y: 4500 },
      { id: "event-shape-1", shapeType: "pentagon", isEventObjective: true, x: 900, y: 900 }
    ],
    tanks: [
      createTank("player-1", "alive"),
      createTank("bot-1", "alive")
    ]
  });
  const next = createSnapshot({
    shapes: [],
    tanks: [
      createTank("player-1", "alive"),
      createTank("bot-1", "dead")
    ]
  });
  const events = deriveAudioEvents({
    previousSnapshot: previous,
    nextSnapshot: next,
    playerId: "player-1",
    nowMs: 2000
  });
  assert.ok(events.some((event) => event.role === "destroyShape"));
  assert.ok(events.some((event) => event.role === "alphaDestroy"));
  assert.ok(events.some((event) => event.role === "eventObjective"));
  assert.ok(events.some((event) => event.role === "destroyTank"));

  const deathEvents = deriveAudioEvents({
    playerId: "player-1",
    deathMessage: { type: "death" },
    nowMs: 2100
  });
  assert.equal(deathEvents.filter((event) => event.role === "death").length, 1);
  assert.equal(deathEvents[0].importance, "critical");
  assert.equal(deathEvents[0].gain, AUDIO_CONFIG.sfxRules.roleGain.localDeath);
});

test("sector event spawn emits a bounded high-priority objective sound after first snapshot", () => {
  const previous = createSnapshot({ eventObjectives: [] });
  const next = createSnapshot({
    eventObjectives: [
      { id: "event-1", typeId: "volatileTriangle", x: 500, y: 100, threatLevel: 3 }
    ]
  });

  const events = deriveAudioEvents({
    previousSnapshot: previous,
    nextSnapshot: next,
    playerId: "player-1",
    nowMs: 2350
  });
  const event = events.find((candidate) => candidate.role === "eventObjective");

  assert.ok(event);
  assert.equal(event.importance, "high");
  assert.ok(event.priority > AUDIO_CONFIG.sfxRules.priority.destroyShape);
  assert.ok(event.gain >= AUDIO_CONFIG.sfxRules.roleGain.eventObjectiveMin);
});

test("alpha destroy keeps an audible minimum gain even when far away", () => {
  const previous = createSnapshot({
    shapes: [
      { id: "alpha-1", shapeType: "alphaPentagon", isCenterObjective: true, x: 4500, y: 4500 }
    ],
    tanks: [createTank("player-1", "alive")]
  });
  const next = createSnapshot({ shapes: [], tanks: [createTank("player-1", "alive")] });

  const events = deriveAudioEvents({
    previousSnapshot: previous,
    nextSnapshot: next,
    playerId: "player-1",
    nowMs: 2200
  });
  const alpha = events.find((event) => event.role === "alphaDestroy");

  assert.ok(alpha);
  assert.equal(alpha.importance, "critical");
  assert.ok(alpha.gain >= AUDIO_CONFIG.sfxRules.roleGain.alphaDestroyMin);
  assert.ok(alpha.priority > AUDIO_CONFIG.sfxRules.priority.fire);
});

test("level and upgrade audio events carry role-aware gain and importance", () => {
  const events = deriveAudioEvents({
    previousSnapshot: createSnapshot(),
    nextSnapshot: createSnapshot(),
    playerId: "player-1",
    visualEffects: [
      { type: "levelToast" },
      { type: "upgradeReady" }
    ],
    nowMs: 2300
  });
  const level = events.find((event) => event.role === "levelUp");
  const upgrade = events.find((event) => event.role === "upgradeReady");

  assert.equal(level.importance, "critical");
  assert.equal(level.gain, AUDIO_CONFIG.sfxRules.roleGain.localLevelUp);
  assert.equal(upgrade.importance, "high");
  assert.equal(upgrade.gain, AUDIO_CONFIG.sfxRules.roleGain.localUpgradeReady);
  assert.ok(level.priority > upgrade.priority);
});

test("audio event limiter blocks spam by bucket", () => {
  const limiter = createAudioEventLimiter({
    debug: { eventStatsWindowMs: 1000 },
    sfx: { fire: { bucket: "fire" } },
    sfxRules: {
      maxPerSecond: { fire: 2 },
      priority: {},
      distance: { enabled: false }
    }
  });
  assert.equal(limiter.accept({ role: "fire", bucket: "fire" }, 1000), true);
  assert.equal(limiter.accept({ role: "fire", bucket: "fire" }, 1100), true);
  assert.equal(limiter.accept({ role: "fire", bucket: "fire" }, 1200), false);
  assert.equal(limiter.accept({ role: "fire", bucket: "fire" }, 2101), true);
});

test("fire audio feedback profiles expose bounded pitch, gain, and cooldown tuning", () => {
  const missile = getAudioProfileForFireEvent({ feedbackProfile: "missile" });
  assert.ok(missile.gainMultiplier > 1);
  assert.ok(missile.pitchMultiplier < 1);
  assert.ok(missile.cooldownMs >= 100);

  const fallback = getAudioProfileForFireEvent({ feedbackProfile: "missing-profile" });
  assert.deepEqual(fallback, AUDIO_CONFIG.sfxRules.feedbackProfiles.standard);
});

test("audio event limiter respects fire profile cooldown", () => {
  const limiter = createAudioEventLimiter(AUDIO_CONFIG);
  const event = { role: "fire", bucket: "fire", feedbackProfile: "heavy" };
  assert.equal(limiter.accept(event, 5000), true);
  assert.equal(limiter.accept(event, 5000 + AUDIO_CONFIG.sfxRules.feedbackProfiles.heavy.cooldownMs - 1), false);
  assert.equal(limiter.accept(event, 5000 + AUDIO_CONFIG.sfxRules.feedbackProfiles.heavy.cooldownMs + 1), true);
});

function createSnapshot({
  projectiles = [],
  shapes = [{ id: "shape-1", shapeType: "square", x: 130, y: 100 }],
  tanks = [createTank("player-1", "alive")],
  eventObjectives = []
} = {}) {
  return {
    tick: 1,
    timeMs: 1000,
    tanks,
    projectiles,
    shapes,
    eventObjectives,
    leaderboard: [],
    counts: {}
  };
}

function createTank(id, state) {
  return {
    id,
    kind: id === "player-1" ? "player" : "bot",
    state,
    x: id === "player-1" ? 100 : 180,
    y: 100,
    hp: state === "alive" ? 100 : 0,
    maxHp: 100,
    radius: 22
  };
}
