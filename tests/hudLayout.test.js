import test from "node:test";
import assert from "node:assert/strict";
import { boxesOverlap, computeHudSafeZones } from "../client/src/ui/hudLayout.js";

test("desktop class cards avoid bottom bars, minimap, and side docks", () => {
  const layout = computeHudSafeZones({
    viewport: { width: 1280, height: 720 },
    upgradeCollapsed: false,
    classCardsVisible: true
  });

  assert.equal(boxesOverlap(layout.classCards, layout.bottomStatus, 4), false);
  assert.equal(boxesOverlap(layout.classCards, layout.minimap, 4), false);
  assert.equal(boxesOverlap(layout.classCards, layout.topLeftDock, 4), false);
  assert.equal(boxesOverlap(layout.classCards, layout.rightDock, 4), false);
});

test("tablet layout keeps class cards above bottom status", () => {
  const layout = computeHudSafeZones({
    viewport: { width: 1024, height: 768 },
    upgradeCollapsed: true,
    classCardsVisible: true
  });

  assert.equal(boxesOverlap(layout.classCards, layout.bottomStatus, 4), false);
  assert.equal(layout.classCards.width > 0, true);
});

test("mobile layout reserves vertical space for class cards", () => {
  const layout = computeHudSafeZones({
    viewport: { width: 390, height: 720 },
    upgradeCollapsed: false,
    classCardsVisible: true
  });

  assert.equal(layout.viewport.mobile, true);
  assert.equal(boxesOverlap(layout.classCards, layout.bottomStatus, 4), false);
  assert.equal(boxesOverlap(layout.classCards, layout.topLeftDock, 4), false);
  assert.equal(boxesOverlap(layout.classCards, layout.touchZones.move, 4), false);
  assert.equal(boxesOverlap(layout.classCards, layout.touchZones.aim, 4), false);
  assert.equal(boxesOverlap(layout.classCards, layout.touchZones.fireLock, 4), false);
  assert.equal(layout.cssVars["--class-card-bottom"], "256px");
  assert.equal(layout.cssVars["--mobile-class-card-height"], "148px");
  assert.equal(layout.cssVars["--touch-fire-lock-bottom"], "122px");
});

test("small mobile layout keeps touch zones, cards, and bottom HUD separated", () => {
  const layout = computeHudSafeZones({
    viewport: { width: 360, height: 640 },
    upgradeCollapsed: false,
    classCardsVisible: true
  });

  assert.equal(layout.viewport.mobile, true);
  assert.equal(boxesOverlap(layout.classCards, layout.bottomStatus, 4), false);
  assert.equal(boxesOverlap(layout.classCards, layout.topLeftDock, 0), false);
  assert.equal(boxesOverlap(layout.classCards, layout.touchZones.move, 4), false);
  assert.equal(boxesOverlap(layout.classCards, layout.touchZones.aim, 4), false);
  assert.equal(boxesOverlap(layout.classCards, layout.touchZones.fireLock, 4), false);
  assert.equal(boxesOverlap(layout.touchZones.move, layout.bottomStatus, 4), false);
  assert.equal(boxesOverlap(layout.touchZones.aim, layout.bottomStatus, 4), false);
});

test("desktop safe-zone output keeps touch boxes inactive", () => {
  const layout = computeHudSafeZones({
    viewport: { width: 1280, height: 720 },
    upgradeCollapsed: false,
    classCardsVisible: true
  });

  assert.equal(layout.viewport.mobile, false);
  assert.equal(layout.touchZones.move, null);
  assert.equal(layout.touchZones.aim, null);
  assert.equal(layout.touchZones.fireLock, null);
  assert.equal(layout.cssVars["--class-card-bottom"], "122px");
});
