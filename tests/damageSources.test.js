import test from "node:test";
import assert from "node:assert/strict";
import {
  DAMAGE_CAUSES,
  createDamageSourceInfo,
  formatDamageCause,
  getDamageCause,
  isContactDamageCause
} from "../shared/sim/damageSources.js";

test("projectile kinds map to readable damage causes", () => {
  assert.equal(getDamageCause({ kind: "bullet", behavior: "bullet" }), DAMAGE_CAUSES.BULLET);
  assert.equal(getDamageCause({ kind: "rocket", behavior: "rocket" }), DAMAGE_CAUSES.ROCKET);
  assert.equal(getDamageCause({ kind: "spark", behavior: "bullet" }), DAMAGE_CAUSES.SPARK);
  assert.equal(getDamageCause({ kind: "trap", behavior: "trap" }), DAMAGE_CAUSES.TRAP);
  assert.equal(getDamageCause({ kind: "drone", behavior: "drone" }), DAMAGE_CAUSES.DRONE);
});

test("contact sources distinguish tank, shape, and Alpha damage", () => {
  assert.equal(getDamageCause({ kind: "contact", ownerKind: "bot" }), DAMAGE_CAUSES.TANK_CONTACT);
  assert.equal(getDamageCause({ kind: "contact", ownerKind: "shape", ownerShapeType: "square" }), DAMAGE_CAUSES.SHAPE_CONTACT);
  assert.equal(getDamageCause({ kind: "contact", ownerKind: "shape", ownerShapeType: "alphaPentagon", ownerIsCenterObjective: true }), DAMAGE_CAUSES.ALPHA_CONTACT);
  assert.equal(isContactDamageCause(DAMAGE_CAUSES.TANK_CONTACT), true);
  assert.equal(isContactDamageCause(DAMAGE_CAUSES.ROCKET), false);
});

test("damage source info is finite, labeled, and player-readable", () => {
  const info = createDamageSourceInfo({
    source: {
      id: "rocket-1",
      kind: "rocket",
      behavior: "rocket",
      ownerId: "bot-1",
      ownerName: "SniperBot",
      ownerKind: "bot",
      x: 20,
      y: 30
    },
    target: { x: 50, y: 30 },
    amount: 18.7,
    timeMs: 1234.2
  });

  assert.equal(info.amount, 19);
  assert.equal(info.cause, DAMAGE_CAUSES.ROCKET);
  assert.equal(info.sourceId, "bot-1");
  assert.equal(info.sourceName, "SniperBot");
  assert.equal(info.sourceX, 20);
  assert.equal(info.targetX, 50);
  assert.equal(formatDamageCause(info), "SniperBot's rocket");
});

test("Alpha contact formats as objective collision", () => {
  const info = createDamageSourceInfo({
    source: {
      kind: "contact",
      ownerKind: "shape",
      ownerName: "Alpha Pentagon",
      ownerShapeType: "alphaPentagon",
      ownerIsCenterObjective: true
    },
    target: { x: 1, y: 2 },
    amount: 5
  });

  assert.equal(info.cause, DAMAGE_CAUSES.ALPHA_CONTACT);
  assert.equal(formatDamageCause(info), "Alpha collision");
});
