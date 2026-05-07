import test from "node:test";
import assert from "node:assert/strict";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";
import { createShape, createTank } from "../shared/sim/entityFactory.js";
import { chooseShapeType, findSafeSpawn } from "../server/src/spawnSystem.js";

test("findSafeSpawn returns an in-world point away from blockers", () => {
  const state = {
    tanks: new Map([
      ["tank-1", createTank({ id: "tank-1", name: "Blocker", x: 3000, y: 3000, color: "#fff" })]
    ]),
    shapes: new Map()
  };
  const rngValues = [0.1, 0.1];
  const point = findSafeSpawn({
    state,
    radius: GAME_CONFIG.tank.radius,
    rng: () => rngValues.shift() ?? 0.1,
    config: GAME_CONFIG
  });

  assert.ok(point.x >= GAME_CONFIG.tank.radius);
  assert.ok(point.y >= GAME_CONFIG.tank.radius);
  assert.ok(point.x < 1000);
  assert.ok(point.y < 1000);
});

test("findSafeSpawn falls back to a valid corner when attempts are blocked", () => {
  const blockers = [
    createTank({ id: "tank-1", name: "A", x: 80, y: 80, color: "#fff" }),
    createTank({ id: "tank-2", name: "B", x: GAME_CONFIG.world.width - 80, y: 80, color: "#fff" }),
    createTank({ id: "tank-3", name: "C", x: 80, y: GAME_CONFIG.world.height - 80, color: "#fff" })
  ];
  const state = {
    tanks: new Map(blockers.map((tank) => [tank.id, tank])),
    shapes: new Map([
      ["shape-1", createShape({ id: "shape-1", shapeType: "square", x: 3000, y: 3000 })]
    ])
  };

  const point = findSafeSpawn({
    state,
    radius: GAME_CONFIG.tank.radius,
    rng: () => 0.5,
    attempts: 1,
    safetyRadius: 10000,
    config: GAME_CONFIG
  });

  assert.ok(point.x >= GAME_CONFIG.tank.radius);
  assert.ok(point.y >= GAME_CONFIG.tank.radius);
  assert.ok(point.x <= GAME_CONFIG.world.width - GAME_CONFIG.tank.radius);
  assert.ok(point.y <= GAME_CONFIG.world.height - GAME_CONFIG.tank.radius);
});

test("findSafeSpawn avoids the center objective exclusion zone", () => {
  const state = {
    tanks: new Map(),
    shapes: new Map()
  };
  const rngValues = [0.5, 0.5, 0.1, 0.1];
  const point = findSafeSpawn({
    state,
    radius: GAME_CONFIG.tank.radius,
    rng: () => rngValues.shift() ?? 0.1,
    config: GAME_CONFIG
  });

  const dx = point.x - GAME_CONFIG.world.width / 2;
  const dy = point.y - GAME_CONFIG.world.height / 2;
  assert.ok(dx * dx + dy * dy > 760 ** 2);
  assert.ok(point.x < 1200);
  assert.ok(point.y < 1200);
});

test("shape selection uses configured weights", () => {
  assert.equal(chooseShapeType(() => 0, GAME_CONFIG), "square");
  assert.equal(chooseShapeType(() => 0.99, GAME_CONFIG), "pentagon");
});
