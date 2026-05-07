import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPredictionFrame,
  createPredictionState,
  getPredictedLocalTank,
  reconcilePrediction,
  recordLocalInput
} from "../client/src/game/localPrediction.js";

const world = { width: 6000, height: 6000 };

test("prediction moves local tank immediately on the next frame", () => {
  const prediction = createPredictionState();
  const serverTank = makeTank({ x: 1000, y: 1000 });

  applyPredictionFrame({
    prediction,
    serverTank,
    input: { moveX: 1, moveY: 0, aimAngle: 0 },
    dtMs: 16,
    world,
    nowMs: 16
  });

  assert.ok(prediction.predictedTank.x > serverTank.x);
  assert.equal(prediction.mode, "predicting");
});

test("prediction applies booster recoil as forward thrust while firing", () => {
  const prediction = createPredictionState();
  const serverTank = makeTank({ classId: "booster", x: 1000, y: 1000, fireCooldownMs: 0 });

  applyPredictionFrame({
    prediction,
    serverTank,
    input: { moveX: 0, moveY: 0, aimAngle: 0, fire: true },
    dtMs: 16,
    world,
    nowMs: 16
  });

  assert.ok(prediction.predictedTank.recoilX > 0);
  assert.ok(prediction.lastFireImpulse.x > 0);
  assert.ok(prediction.predictedTank.fireCooldownMs > 0);
});

test("reconcile drops acknowledged pending inputs", () => {
  const prediction = createPredictionState();
  recordLocalInput(prediction, { seq: 1, moveX: 1, moveY: 0 }, 10);
  recordLocalInput(prediction, { seq: 2, moveX: 1, moveY: 0 }, 20);
  prediction.predictedTank = makeTank({ x: 1000, y: 1000 });

  reconcilePrediction(prediction, makeTank({ x: 1000, y: 1000, lastInputSeq: 1 }), 30);

  assert.deepEqual(prediction.pendingInputs.map((input) => input.seq), [2]);
  assert.equal(prediction.lastServerSeq, 1);
});

test("small prediction errors keep the current visual position while correcting baseline", () => {
  const prediction = createPredictionState();
  prediction.predictedTank = makeTank({ x: 1000, y: 1000 });

  reconcilePrediction(prediction, makeTank({ x: 1010, y: 1000, lastInputSeq: 0 }), 100);
  const renderTank = getPredictedLocalTank(prediction, makeSnapshot(makeTank({ x: 1010, y: 1000 })), "player-1", 100);

  assert.equal(prediction.mode, "correcting");
  assert.equal(renderTank.x, 1000);
  assert.ok(prediction.predictedTank.x > 1000);
  assert.ok(prediction.predictedTank.x < 1010);
});

test("visual correction offset decays on prediction frames", () => {
  const prediction = createPredictionState();
  prediction.predictedTank = makeTank({ x: 1000, y: 1000 });
  reconcilePrediction(prediction, makeTank({ x: 1020, y: 1000, lastInputSeq: 0 }), 100);
  const firstOffset = Math.abs(prediction.correctionX);

  applyPredictionFrame({
    prediction,
    serverTank: makeTank({ x: 1020, y: 1000, lastInputSeq: 0 }),
    input: { moveX: 0, moveY: 0, aimAngle: 0 },
    dtMs: 70,
    world,
    nowMs: 170
  });

  assert.ok(Math.abs(prediction.correctionX) < firstOffset);
});

test("large prediction errors snap to server position", () => {
  const prediction = createPredictionState();
  prediction.predictedTank = makeTank({ x: 1000, y: 1000 });

  reconcilePrediction(prediction, makeTank({ x: 1200, y: 1000, lastInputSeq: 0 }), 100);

  assert.equal(prediction.predictedTank.x, 1200);
  assert.equal(prediction.correctionX, 0);
});

test("dead server tank disables prediction", () => {
  const prediction = createPredictionState();
  prediction.predictedTank = makeTank({ x: 1000, y: 1000 });

  reconcilePrediction(prediction, makeTank({ state: "dead" }), 100);

  assert.equal(prediction.predictedTank, null);
  assert.equal(prediction.mode, "idle");
});

function makeSnapshot(tank) {
  return {
    tanks: [tank]
  };
}

function makeTank(overrides = {}) {
  return {
    id: "player-1",
    kind: "player",
    state: "alive",
    x: 1000,
    y: 1000,
    vx: 0,
    vy: 0,
    angle: 0,
    radius: 22,
    classId: "basic",
    upgrades: {},
    lastInputSeq: 0,
    fireCooldownMs: 0,
    recoilX: 0,
    recoilY: 0,
    hp: 100,
    maxHp: 100,
    ...overrides
  };
}
