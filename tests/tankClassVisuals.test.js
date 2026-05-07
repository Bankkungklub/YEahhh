import test from "node:test";
import assert from "node:assert/strict";
import {
  TANK_CLASS_ACCENT_TYPES,
  TANK_CLASS_BARREL_STYLES,
  TANK_CLASS_CONFIG,
  TANK_CLASS_ICON_BODIES,
  TANK_CLASS_ICON_CORES,
  TANK_CLASS_ICON_RINGS
} from "../shared/config/tankClassConfig.js";
import { getClassVisualSignature } from "../shared/sim/tankClassBalance.js";
import { getClassPath } from "../shared/sim/tankClasses.js";

test("every tank class exposes the extended visual icon schema", () => {
  for (const tankClass of Object.values(TANK_CLASS_CONFIG.classes)) {
    assert.ok(TANK_CLASS_ICON_BODIES.includes(tankClass.icon.body), `${tankClass.id} body`);
    assert.ok(TANK_CLASS_ICON_RINGS.includes(tankClass.icon.ring), `${tankClass.id} ring`);
    assert.ok(TANK_CLASS_ICON_CORES.includes(tankClass.icon.core), `${tankClass.id} core`);
    assert.ok(Number.isFinite(tankClass.icon.bodyScale) && tankClass.icon.bodyScale > 0, `${tankClass.id} bodyScale`);
    assert.ok(Array.isArray(tankClass.icon.barrels) && tankClass.icon.barrels.length > 0, `${tankClass.id} barrels`);
    for (const barrel of tankClass.icon.barrels) {
      assert.ok(TANK_CLASS_BARREL_STYLES.includes(barrel.style), `${tankClass.id} barrel style`);
      assert.ok(Number.isFinite(barrel.angle), `${tankClass.id} barrel angle`);
      assert.ok(Number.isFinite(barrel.length) && barrel.length > 0, `${tankClass.id} barrel length`);
      assert.ok(Number.isFinite(barrel.width) && barrel.width > 0, `${tankClass.id} barrel width`);
    }
    for (const accent of tankClass.icon.accents) {
      assert.ok(TANK_CLASS_ACCENT_TYPES.includes(accent.type), `${tankClass.id} accent type`);
      assert.ok(Number.isFinite(accent.angle), `${tankClass.id} accent angle`);
      assert.ok(Number.isFinite(accent.size) && accent.size > 0, `${tankClass.id} accent size`);
      assert.ok(Number.isFinite(accent.offset) && accent.offset > 0, `${tankClass.id} accent offset`);
    }
  }
});

test("level 45 and 60 forms have distinct visual signatures from their parents", () => {
  for (const tankClass of Object.values(TANK_CLASS_CONFIG.classes)) {
    if (![45, 60].includes(tankClass.unlockLevel)) {
      continue;
    }
    const path = getClassPath(tankClass.id);
    const parentId = path[path.length - 2];
    assert.notEqual(
      getClassVisualSignature(tankClass.id),
      getClassVisualSignature(parentId),
      `${tankClass.id} should not visually duplicate ${parentId}`
    );
  }
});

test("special roles use readable silhouettes and barrel styles", () => {
  assert.equal(TANK_CLASS_CONFIG.classes.spike.icon.body, "spike");
  assert.equal(TANK_CLASS_CONFIG.classes.rammer.icon.body, "diamond");
  assert.equal(TANK_CLASS_CONFIG.classes.fireworkTank.icon.barrels[0].style, "rocket");
  assert.equal(TANK_CLASS_CONFIG.classes.starburst.icon.barrels[0].style, "rocket");
  assert.equal(TANK_CLASS_CONFIG.classes.missileCommand.icon.barrels[0].style, "rocket");
  assert.equal(TANK_CLASS_CONFIG.classes.trapper.icon.barrels[0].style, "trap");
  assert.equal(TANK_CLASS_CONFIG.classes.aegisBastion.icon.barrels[0].style, "trap");
  assert.ok(TANK_CLASS_CONFIG.classes.predator.icon.barrels.some((barrel) => barrel.style === "long"));
  assert.ok(TANK_CLASS_CONFIG.classes.annihilator.icon.barrels.some((barrel) => barrel.style === "heavy"));
});

test("missing class visual signature falls back to the basic tank", () => {
  assert.equal(getClassVisualSignature("not-a-class"), getClassVisualSignature("basic"));
});
