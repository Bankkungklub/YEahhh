import test from "node:test";
import assert from "node:assert/strict";
import {
  COMBAT_FEEL_CONFIG,
  getProjectileVisual,
  validateCombatFeelConfig
} from "../shared/config/combatFeelConfig.js";
import { appendCombatEffects } from "../client/src/game/combatEffects.js";

const REQUIRED_VISUAL_KEYS = [
  "fill",
  "core",
  "trail",
  "trailMs",
  "trailWidth",
  "trailAlpha",
  "outlineColor",
  "outlineWidth",
  "pulseColor",
  "warningRing",
  "impactStyle"
];

test("projectile threat visual config validates and covers every kind", () => {
  assert.deepEqual(validateCombatFeelConfig(), []);
  for (const kind of ["bullet", "rocket", "spark", "trap"]) {
    const visual = COMBAT_FEEL_CONFIG.projectileVisuals[kind];
    for (const key of REQUIRED_VISUAL_KEYS) {
      assert.ok(key in visual, `${kind} missing ${key}`);
    }
  }
});

test("projectile kinds have distinct threat language defaults", () => {
  assert.equal(getProjectileVisual("bullet").impactStyle, "ring");
  assert.equal(getProjectileVisual("rocket").impactStyle, "shockwave");
  assert.equal(getProjectileVisual("spark").impactStyle, "shards");
  assert.equal(getProjectileVisual("trap").warningRing, "armed");
  assert.equal(getProjectileVisual("unknown-kind").impactStyle, "ring");
});

test("combat effects preserve projectile threat style metadata", () => {
  const effects = [];
  appendCombatEffects({
    previousSnapshot: {
      projectiles: [
        {
          id: "spark-1",
          kind: "spark",
          x: 50,
          y: 80,
          radius: 5,
          fillColor: "#f25f4c"
        }
      ]
    },
    nextSnapshot: {
      projectiles: [
        {
          id: "rocket-1",
          kind: "rocket",
          x: 10,
          y: 20,
          spawnX: 8,
          spawnY: 20,
          angle: 0,
          radius: 8,
          coreColor: "#fff1a8"
        }
      ]
    },
    append: (effect) => effects.push(effect)
  });

  const muzzle = effects.find((effect) => effect.type === "muzzleFlash");
  const impact = effects.find((effect) => effect.type === "impactBurst");
  assert.equal(muzzle.kind, "rocket");
  assert.equal(muzzle.impactStyle, "shockwave");
  assert.equal(impact.kind, "spark");
  assert.equal(impact.impactStyle, "shards");
});
