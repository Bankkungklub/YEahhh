import test from "node:test";
import assert from "node:assert/strict";
import { DRONE_CONFIG, getDroneLoadout, validateDroneConfig } from "../shared/config/droneConfig.js";
import {
  applyDroneDamage,
  buildDroneCommand,
  canConvertShapeToDrone,
  createDrone,
  getDroneSnapshot,
  getOwnerDroneCounts,
  shouldDroneHitTarget,
  updateDroneMotion
} from "../shared/sim/drones.js";

test("drone config validates all control branch loadouts", () => {
  assert.deepEqual(validateDroneConfig(DRONE_CONFIG), []);
  assert.equal(getDroneLoadout("overseer").maxDrones, 2);
  assert.equal(getDroneLoadout("overlord").maxDrones, 4);
  assert.equal(getDroneLoadout("necromancer").maxDrones, 8);
  assert.equal(getDroneLoadout("hiveLord").maxDrones, 10);
});

test("drone commands and motion stay finite in orbit and attack modes", () => {
  const loadout = getDroneLoadout("overseer");
  const owner = createOwner({ input: { fire: false, aimAngle: 0 } });
  const drone = createDrone({ id: "drone-1", owner, loadout, nowMs: 0 });

  updateDroneMotion({
    drone,
    owner,
    loadout,
    command: buildDroneCommand(owner, loadout),
    dtSeconds: 0.1,
    nowMs: 100,
    world: { width: 9000, height: 9000 }
  });

  assert.equal(drone.mode, "orbit");
  assert.ok(Number.isFinite(drone.x));
  assert.ok(Number.isFinite(drone.y));

  owner.input.fire = true;
  owner.input.aimAngle = Math.PI / 4;
  updateDroneMotion({
    drone,
    owner,
    loadout,
    command: buildDroneCommand(owner, loadout),
    dtSeconds: 0.1,
    nowMs: 200,
    world: { width: 9000, height: 9000 }
  });

  assert.equal(drone.mode, "attack");
  assert.ok(Number.isFinite(drone.targetX));
  assert.ok(Number.isFinite(drone.targetY));
});

test("drone hit cooldown and damage state are bounded", () => {
  const loadout = getDroneLoadout("overlord");
  const drone = createDrone({ id: "drone-2", owner: createOwner(), loadout, nowMs: 0 });
  const target = { id: "shape-1", state: "alive" };

  assert.equal(shouldDroneHitTarget(drone, target, 100), true);
  drone.hitCooldowns[target.id] = 100;
  assert.equal(shouldDroneHitTarget(drone, target, 200), false);
  assert.equal(shouldDroneHitTarget(drone, target, 500), true);

  assert.equal(applyDroneDamage(drone, 7), 7);
  assert.equal(drone.state, "active");
  assert.equal(applyDroneDamage(drone, 999), loadout.maxHp - 7);
  assert.equal(drone.hp, 0);
  assert.equal(drone.state, "dead");
});

test("owner drone counts and snapshots expose lightweight state", () => {
  const loadout = getDroneLoadout("necromancer");
  const owner = createOwner({ id: "necromancer-1", classId: "necromancer" });
  const drones = new Map([
    ["base", createDrone({ id: "base", owner, loadout, slotIndex: 0, nowMs: 0 })],
    ["swarm", createDrone({ id: "swarm", owner, loadout, slotIndex: 4, nowMs: 0, converted: true, ttlMs: 18000 })]
  ]);

  const counts = getOwnerDroneCounts(drones, owner.id, loadout);
  assert.equal(counts.current, 2);
  assert.equal(counts.converted, 1);
  assert.equal(counts.max, 8);

  const snapshot = getDroneSnapshot(drones.get("swarm"));
  assert.equal(snapshot.type, undefined);
  assert.equal(snapshot.ownerId, owner.id);
  assert.equal(snapshot.converted, true);
  assert.ok(Number.isFinite(snapshot.x));
});

test("necromancer conversion rules exclude objectives and respect shape chances", () => {
  const loadout = getDroneLoadout("necromancer");
  const tank = createOwner({ classId: "necromancer" });

  assert.deepEqual(
    canConvertShapeToDrone({ tank, loadout, shape: { shapeType: "square", state: "alive" }, rng: () => 0.2 }),
    { converted: true, count: 1 }
  );
  assert.equal(canConvertShapeToDrone({ tank, loadout, shape: { shapeType: "square", state: "alive" }, rng: () => 0.9 }).converted, false);
  assert.equal(canConvertShapeToDrone({ tank, loadout, shape: { shapeType: "pentagon", state: "alive" }, rng: () => 0.99 }).count, 2);
  assert.equal(canConvertShapeToDrone({ tank, loadout, shape: { shapeType: "triangle", isEventObjective: true }, rng: () => 0 }).converted, false);
  assert.equal(canConvertShapeToDrone({ tank, loadout, shape: { shapeType: "alphaPentagon", isCenterObjective: true }, rng: () => 0 }).converted, false);
});

test("hive lord conversion uses ultimate swarm cap and shorter converted lifetime", () => {
  const loadout = getDroneLoadout("hiveLord");
  const tank = createOwner({ classId: "hiveLord" });

  assert.equal(loadout.baseDrones, 5);
  assert.equal(loadout.maxDrones, 10);
  assert.equal(loadout.convertedDroneTtlMs, 16000);
  assert.deepEqual(
    canConvertShapeToDrone({ tank, loadout, shape: { shapeType: "triangle", state: "alive" }, rng: () => 0.2 }),
    { converted: true, count: 1 }
  );
});

function createOwner(overrides = {}) {
  return {
    id: "owner-1",
    name: "Owner",
    kind: "player",
    type: "tank",
    classId: "overseer",
    state: "alive",
    color: "#58dede",
    x: 4500,
    y: 4500,
    aimAngle: 0,
    input: { fire: false, aimAngle: 0 },
    ...overrides
  };
}
