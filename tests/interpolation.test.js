import test from "node:test";
import assert from "node:assert/strict";
import { interpolateSnapshots, lerpAngle } from "../client/src/game/clientState.js";

test("interpolates tank and projectile midpoint positions", () => {
  const previous = createSnapshot({
    timeMs: 1000,
    tankX: 100,
    tankY: 50,
    projectileX: 10,
    projectileY: 20,
    angle: 0
  });
  const next = createSnapshot({
    timeMs: 1100,
    tankX: 200,
    tankY: 150,
    projectileX: 50,
    projectileY: 100,
    angle: Math.PI / 2
  });

  const render = interpolateSnapshots({
    previous,
    next,
    targetTimeMs: 1050,
    latestSnapshot: next,
    now: 0,
    latestReceivedAt: 0
  });

  assert.equal(render.tanks[0].x, 150);
  assert.equal(render.tanks[0].y, 100);
  assert.equal(render.projectiles[0].x, 30);
  assert.equal(render.projectiles[0].y, 60);
});

test("angle interpolation uses the shortest path across zero degrees", () => {
  const from = degreesToRadians(350);
  const to = degreesToRadians(10);
  const midpoint = lerpAngle(from, to, 0.5);
  const normalizedDegrees = normalizeDegrees(radiansToDegrees(midpoint));

  assert.ok(normalizedDegrees <= 1 || normalizedDegrees >= 359);
});

test("missing previous entities use the newer snapshot without crashing", () => {
  const previous = {
    ...createSnapshot({ timeMs: 1000, tankX: 100, tankY: 100 }),
    tanks: [],
    projectiles: []
  };
  const next = createSnapshot({
    timeMs: 1100,
    tankX: 240,
    tankY: 260,
    projectileX: 80,
    projectileY: 90
  });

  const render = interpolateSnapshots({
    previous,
    next,
    targetTimeMs: 1050,
    latestSnapshot: next,
    now: 0,
    latestReceivedAt: 0
  });

  assert.equal(render.tanks[0].x, 240);
  assert.equal(render.projectiles[0].x, 80);
});

test("local visual extrapolation is capped at 80 milliseconds", () => {
  const previous = createSnapshot({
    timeMs: 1000,
    tankX: 100,
    tankY: 100,
    tankVx: 100,
    tankVy: 0
  });
  const next = createSnapshot({
    timeMs: 1100,
    tankX: 200,
    tankY: 100,
    tankVx: 100,
    tankVy: 0
  });

  const render = interpolateSnapshots({
    previous,
    next,
    targetTimeMs: 1100,
    playerId: "player-1",
    latestSnapshot: next,
    now: 200,
    latestReceivedAt: 0
  });

  assert.equal(render.tanks[0].x, 208);
});

function createSnapshot({
  timeMs,
  tankX,
  tankY,
  tankVx = 0,
  tankVy = 0,
  projectileX = 0,
  projectileY = 0,
  angle = 0
}) {
  return {
    tick: Math.round(timeMs / 100),
    timeMs,
    world: { width: 6000, height: 6000, gridSize: 120 },
    tanks: [
      {
        id: "player-1",
        kind: "player",
        name: "Bank",
        x: tankX,
        y: tankY,
        vx: tankVx,
        vy: tankVy,
        angle,
        radius: 22,
        color: "#3da9fc",
        hp: 100,
        maxHp: 100,
        level: 1,
        xp: 0,
        xpNext: 95,
        score: 0,
        upgradePoints: 0,
        upgrades: {},
        state: "alive"
      }
    ],
    projectiles: [
      {
        id: "bullet-1",
        ownerId: "player-1",
        x: projectileX,
        y: projectileY,
        radius: 6,
        angle
      }
    ],
    shapes: [
      {
        id: "shape-1",
        x: 300,
        y: 300,
        radius: 24,
        hp: 24,
        maxHp: 24,
        sides: 4,
        color: "#faae2b"
      }
    ],
    leaderboard: [],
    counts: {}
  };
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value) {
  return (value * 180) / Math.PI;
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}
