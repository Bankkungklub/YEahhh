import test from "node:test";
import assert from "node:assert/strict";
import { getCameraWorldBounds, isCircleVisible } from "../client/src/render/canvasRenderer.js";

test("camera world bounds include the configured padding", () => {
  const bounds = getCameraWorldBounds({
    x: 1000,
    y: 900,
    width: 800,
    height: 600,
    scale: 1
  }, 160);

  assert.deepEqual(bounds, {
    left: 440,
    right: 1560,
    top: 440,
    bottom: 1360
  });
});

test("circle visibility includes entities inside the viewport", () => {
  const bounds = { left: 0, right: 100, top: 0, bottom: 100 };

  assert.equal(isCircleVisible({ x: 50, y: 50, radius: 10 }, bounds), true);
});

test("circle visibility excludes entities outside the viewport", () => {
  const bounds = { left: 0, right: 100, top: 0, bottom: 100 };

  assert.equal(isCircleVisible({ x: 150, y: 50, radius: 10 }, bounds), false);
});

test("circle visibility keeps edge-touching entities visible", () => {
  const bounds = { left: 0, right: 100, top: 0, bottom: 100 };

  assert.equal(isCircleVisible({ x: 112, y: 50, radius: 12 }, bounds), true);
});

test("circle visibility tolerates missing radius as zero", () => {
  const bounds = { left: 0, right: 100, top: 0, bottom: 100 };

  assert.equal(isCircleVisible({ x: 100, y: 100 }, bounds), true);
  assert.equal(isCircleVisible({ x: 101, y: 100 }, bounds), false);
});
