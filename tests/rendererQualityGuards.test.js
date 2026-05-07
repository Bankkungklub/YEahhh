import test from "node:test";
import assert from "node:assert/strict";
import { normalizeQualityFlags } from "../client/src/render/canvasRenderer.js";

test("renderer quality guards tolerate null flags", () => {
  const flags = normalizeQualityFlags(null);

  assert.equal(flags.mode, "high");
  assert.equal(flags.drawClouds, true);
  assert.equal(flags.drawGrassBands, true);
  assert.equal(flags.drawProjectileTrails, true);
  assert.equal(flags.effectCap, 80);
});

test("renderer quality guards merge partial flags", () => {
  const flags = normalizeQualityFlags({ mode: "low", drawClouds: false, projectileTrailBudget: 0 });

  assert.equal(flags.mode, "low");
  assert.equal(flags.drawClouds, false);
  assert.equal(flags.drawGrassBands, true);
  assert.equal(flags.projectileTrailBudget, 0);
});
