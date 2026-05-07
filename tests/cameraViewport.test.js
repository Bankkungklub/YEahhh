import test from "node:test";
import assert from "node:assert/strict";
import {
  computeCameraScale,
  computeVisibleWorldSize,
  getViewportProfile
} from "../client/src/render/cameraViewport.js";
import { getMinimapBoxFromLayout } from "../client/src/render/canvasRenderer.js";

test("desktop camera keeps one-to-one scale", () => {
  const viewport = { width: 1280, height: 720 };
  const profile = getViewportProfile(viewport);

  assert.equal(profile.compactHud, false);
  assert.equal(computeCameraScale(viewport), 1);
});

test("Samsung-like portrait camera zooms out enough for combat readability", () => {
  const viewport = { width: 384, height: 854 };
  const scale = computeCameraScale(viewport);
  const visible = computeVisibleWorldSize(viewport, scale);

  assert.equal(getViewportProfile(viewport).phonePortrait, true);
  assert.ok(scale >= 0.68 && scale <= 0.74);
  assert.ok(visible.width >= 525);
  assert.ok(visible.height >= 1150);
});

test("small mobile portrait keeps a bounded zoom-out", () => {
  const viewport = { width: 390, height: 720 };
  const scale = computeCameraScale(viewport);

  assert.ok(scale >= 0.70 && scale <= 0.74);
  assert.ok(computeVisibleWorldSize(viewport, scale).height >= 990);
});

test("tall Android portrait stays below desktop zoom", () => {
  const viewport = { width: 412, height: 915 };
  const scale = computeCameraScale(viewport);
  const visible = computeVisibleWorldSize(viewport, scale);

  assert.ok(scale < 0.76);
  assert.ok(visible.height >= 1200);
});

test("phone landscape uses compact zoom instead of desktop scale", () => {
  const viewport = { width: 854, height: 384 };
  const profile = getViewportProfile(viewport);
  const scale = computeCameraScale(viewport);

  assert.equal(profile.phoneLandscape, true);
  assert.ok(scale >= 0.72 && scale <= 0.78);
});

test("renderer minimap uses HUD layout when available and keeps desktop fallback", () => {
  assert.deepEqual(
    getMinimapBoxFromLayout({ minimap: { x: 284, y: 12, width: 88, height: 88 } }, { width: 384, height: 854 }),
    { x: 284, y: 12, size: 88 }
  );

  const fallback = getMinimapBoxFromLayout(null, { width: 1280, height: 720 });
  assert.equal(fallback.size, 150);
  assert.equal(fallback.x, 1114);
  assert.equal(fallback.y, 554);
});
