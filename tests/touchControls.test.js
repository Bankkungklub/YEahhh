import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTouchInput,
  createTouchControlsState,
  getTouchMoveVector,
  getTouchOverlayViewModel,
  handleTouchEnd,
  handleTouchMove,
  handleTouchStart,
  resetTouchControls,
  setTouchGameplayActive,
  toggleTouchFireLock
} from "../client/src/input/touchControls.js";

const viewport = { width: 390, height: 720 };
const camera = { x: 1000, y: 1000, width: 390, height: 720, scale: 1 };
const localTank = { x: 1000, y: 1000, angle: 0, aimAngle: 0, state: "alive" };

test("fresh touch state starts disabled with no active sticks", () => {
  const state = makeState();
  const view = getTouchOverlayViewModel(state, { viewport, gameplayActive: false, nowMs: 0 });

  assert.equal(state.moveTouchId, null);
  assert.equal(state.aimTouchId, null);
  assert.equal(view.visible, false);
  assert.equal(view.move.visible, false);
  assert.equal(view.aim.visible, false);
});

test("left touch produces movement and no fire", () => {
  const state = makeState();
  handleTouchStart(state, [touch(1, 50, 500)], viewport, 10);
  handleTouchMove(state, [touch(1, 108, 500)], viewport, 20);

  const input = buildTouchInput(state, { camera, localTank });

  assert.equal(input.active, true);
  assert.ok(input.moveX > 0.9);
  assert.equal(input.moveY, 0);
  assert.equal(input.fire, false);
});

test("right touch aims and fires without movement", () => {
  const state = makeState();
  handleTouchStart(state, [touch(2, 390, 360)], viewport, 10);

  const input = buildTouchInput(state, { camera, localTank });

  assert.equal(input.active, true);
  assert.equal(input.moveX, 0);
  assert.equal(input.moveY, 0);
  assert.equal(input.fire, true);
  assert.equal(Math.round(input.aimAngle * 1000) / 1000, 0);
});

test("simultaneous left and right touches split move and aim/fire", () => {
  const state = makeState();
  handleTouchStart(state, [
    touch(1, 48, 520),
    touch(2, 350, 360)
  ], viewport, 10);
  handleTouchMove(state, [
    touch(1, 48, 462),
    touch(2, 390, 360)
  ], viewport, 20);

  const input = buildTouchInput(state, { camera, localTank });

  assert.ok(input.moveY < -0.9);
  assert.equal(input.fire, true);
  assert.equal(Math.round(input.aimAngle * 1000) / 1000, 0);
});

test("dead zone returns zero movement and clamp caps vector length", () => {
  const state = makeState();
  handleTouchStart(state, [touch(1, 60, 500)], viewport, 10);
  handleTouchMove(state, [touch(1, 64, 503)], viewport, 20);
  assert.deepEqual(getTouchMoveVector(state), { x: 0, y: 0, magnitude: 0 });

  handleTouchMove(state, [touch(1, 260, 500)], viewport, 30);
  const move = getTouchMoveVector(state);
  assert.equal(move.y, 0);
  assert.ok(move.x <= 1);
  assert.equal(move.magnitude, 1);
});

test("ending move stops movement but preserves aim fire", () => {
  const state = makeState();
  handleTouchStart(state, [touch(1, 50, 500), touch(2, 360, 360)], viewport, 10);
  handleTouchMove(state, [touch(1, 108, 500)], viewport, 20);
  handleTouchEnd(state, [touch(1, 108, 500)], 30);

  const input = buildTouchInput(state, { camera, localTank });

  assert.equal(input.moveX, 0);
  assert.equal(input.fire, true);
});

test("ending aim stops fire unless fire lock is enabled", () => {
  const unlocked = makeState();
  handleTouchStart(unlocked, [touch(2, 360, 360)], viewport, 10);
  handleTouchEnd(unlocked, [touch(2, 360, 360)], 20);
  assert.equal(buildTouchInput(unlocked, { camera, localTank }).active, false);

  const locked = makeState();
  handleTouchStart(locked, [touch(2, 360, 360)], viewport, 10);
  buildTouchInput(locked, { camera, localTank });
  toggleTouchFireLock(locked, 15);
  handleTouchEnd(locked, [touch(2, 360, 360)], 20);
  const input = buildTouchInput(locked, { camera, localTank });
  assert.equal(input.active, true);
  assert.equal(input.fire, true);
});

test("touch cancel/end clears matching ids and reset clears fire lock", () => {
  const state = makeState();
  handleTouchStart(state, [touch(1, 50, 500), touch(2, 360, 360)], viewport, 10);
  toggleTouchFireLock(state, 20);
  handleTouchEnd(state, [touch(1, 50, 500), touch(2, 360, 360)], 30);

  assert.equal(state.moveTouchId, null);
  assert.equal(state.aimTouchId, null);
  assert.equal(state.fireLocked, true);

  resetTouchControls(state);
  assert.equal(state.fireLocked, false);
  assert.equal(buildTouchInput(state, { camera, localTank }).active, false);
});

test("touch role is stable after crossing screen halves and duplicate same-side touches are ignored", () => {
  const state = makeState();
  handleTouchStart(state, [touch(1, 40, 500), touch(3, 80, 520)], viewport, 10);
  handleTouchMove(state, [touch(1, 350, 500)], viewport, 20);

  assert.equal(state.moveTouchId, 1);
  assert.equal(state.aimTouchId, null);
  assert.ok(buildTouchInput(state, { camera, localTank }).moveX > 0);
});

test("mobile overlay exposes fire lock while gameplay is active", () => {
  const state = makeState();
  const view = getTouchOverlayViewModel(state, {
    viewport,
    gameplayActive: true,
    nowMs: 0
  });

  assert.equal(view.enabled, true);
  assert.equal(view.visible, true);
  assert.equal(view.fireLockVisible, true);
  assert.equal(view.stickRadiusPx, 66);
  assert.equal(view.knobRadiusPx, 26);
});

test("touch gameplay deactivation clears active touches and fire lock", () => {
  const state = makeState();
  handleTouchStart(state, [touch(1, 50, 500), touch(2, 360, 360)], viewport, 10);
  toggleTouchFireLock(state, 20);

  setTouchGameplayActive(state, false, 30);

  assert.equal(state.gameplayActive, false);
  assert.equal(state.moveTouchId, null);
  assert.equal(state.aimTouchId, null);
  assert.equal(state.fireLocked, false);
  assert.equal(buildTouchInput(state, { camera, localTank }).active, false);

  setTouchGameplayActive(state, true, 40);
  assert.equal(state.gameplayActive, true);
  assert.equal(state.enabled, true);
});

test("invalid touch values never create NaN input", () => {
  const state = makeState();
  handleTouchStart(state, [{ identifier: 1, clientX: Number.NaN, clientY: Number.POSITIVE_INFINITY }], viewport, 10);
  handleTouchMove(state, [{ identifier: 1, clientX: Number.NaN, clientY: Number.NaN }], viewport, 20);

  const input = buildTouchInput(state, { camera, localTank });

  assert.equal(Number.isFinite(input.moveX), true);
  assert.equal(Number.isFinite(input.moveY), true);
  assert.equal(Number.isFinite(input.aimAngle), true);
});

function makeState() {
  const state = createTouchControlsState();
  state.gameplayActive = true;
  return state;
}

function touch(identifier, clientX, clientY) {
  return { identifier, clientX, clientY };
}
