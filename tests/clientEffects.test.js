import test from "node:test";
import assert from "node:assert/strict";
import { deriveEffects, FEEDBACK_CONFIG, pruneEffects } from "../client/src/game/effects.js";

test("first snapshot does not create false hit feedback", () => {
  const snapshot = createSnapshot({
    localHp: 100,
    localScore: 0,
    localLevel: 1,
    shapeHp: 24
  });

  const result = deriveEffects(null, snapshot, "player-1", 1000, 1);
  assert.equal(result.effects.length, 0);
  assert.equal(result.localUpdates.lastLocalLevel, 1);
});

test("snapshot HP deltas create damage text and hit flash", () => {
  const previous = createSnapshot({
    localHp: 100,
    localScore: 0,
    localLevel: 1,
    shapeHp: 24
  });
  const next = createSnapshot({
    localHp: 100,
    localScore: 0,
    localLevel: 1,
    shapeHp: 12
  });

  const result = deriveEffects(previous, next, "player-1", 1000, 1);
  assert.ok(result.effects.some((effect) => effect.type === "hitFlash" && effect.targetType === "shape"));
  assert.ok(result.effects.some((effect) => effect.type === "damageText" && effect.text === "-12"));
});

test("local score and level deltas create reward feedback", () => {
  const previous = createSnapshot({
    localHp: 100,
    localScore: 0,
    localLevel: 1,
    localUpgradePoints: 0,
    shapeHp: 24
  });
  const next = createSnapshot({
    localHp: 100,
    localScore: 80,
    localLevel: 2,
    localUpgradePoints: 1,
    shapeHp: 24
  });

  const result = deriveEffects(previous, next, "player-1", 2000, 20);
  assert.ok(result.effects.some((effect) => effect.type === "xpText" && effect.text === "+80 XP"));
  assert.ok(result.effects.some((effect) => effect.type === "levelToast" && effect.text === "LEVEL 2"));
  assert.ok(result.effects.some((effect) => effect.type === "upgradeReady"));
  assert.equal(result.effects.some((effect) => effect.type === "screenShake"), false);
  assert.ok(result.localUpdates.levelPulseUntilMs > 2000);
  assert.ok(result.localUpdates.upgradePulseUntilMs > 2000);
});

test("local damage creates capped screen shake and pruning removes expired effects", () => {
  const previous = createSnapshot({
    localHp: 100,
    localScore: 0,
    localLevel: 1,
    shapeHp: 24
  });
  const next = createSnapshot({
    localHp: 40,
    localScore: 0,
    localLevel: 1,
    shapeHp: 24
  });

  const result = deriveEffects(previous, next, "player-1", 1000, 1);
  const shake = result.effects.find((effect) => effect.type === "screenShake");
  assert.ok(shake);
  assert.ok(shake.magnitude <= FEEDBACK_CONFIG.screenShakeMaxPx);
  assert.equal(pruneEffects(result.effects, 1000 + 5000).length, 0);
});

function createSnapshot({ localHp, localScore, localLevel, localUpgradePoints = 0, shapeHp }) {
  return {
    tick: 1,
    timeMs: 1000,
    tanks: [
      {
        id: "player-1",
        kind: "player",
        name: "Bank",
        x: 100,
        y: 100,
        radius: 22,
        hp: localHp,
        maxHp: 100,
        score: localScore,
        xp: localScore,
        xpNext: 95,
        level: localLevel,
        upgradePoints: localUpgradePoints,
        upgrades: {},
        state: localHp > 0 ? "alive" : "dead"
      }
    ],
    shapes: [
      {
        id: "shape-1",
        shapeType: "square",
        x: 160,
        y: 100,
        radius: 24,
        hp: shapeHp,
        maxHp: 24,
        sides: 4,
        color: "#faae2b"
      }
    ],
    projectiles: [],
    leaderboard: [],
    counts: {}
  };
}
