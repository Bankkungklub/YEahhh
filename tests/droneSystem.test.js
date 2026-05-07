import test from "node:test";
import assert from "node:assert/strict";
import { ServerGame } from "../server/src/serverGame.js";
import { resolveDroneContactDamage } from "../server/src/droneSystem.js";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";
import { createProjectile, createShape } from "../shared/sim/entityFactory.js";
import { selectTankClass } from "../shared/sim/tankClasses.js";

test("overseer and overlord rebuild drones without spawning normal bullets", () => {
  const game = createTinyGame();
  const tank = game.createHumanPlayer("client-1", "Bank");
  tank.level = 45;
  assert.equal(selectTankClass(tank, "sniper"), true);
  assert.equal(selectTankClass(tank, "overseer"), true);

  game.spawnProjectile(tank);
  assert.equal(game.projectiles.size, 0);

  stepFor(game, 0.1);
  assert.equal(getOwnedDrones(game, tank.id).length, 1);
  stepFor(game, 2);
  assert.equal(getOwnedDrones(game, tank.id).length, 2);

  assert.equal(game.selectTankClass(tank.id, "overlord"), true);
  assert.equal(getOwnedDrones(game, tank.id).length, 0, "class change should clean old drones");
  stepFor(game, 0.1);
  stepFor(game, 2);
  stepFor(game, 2);
  stepFor(game, 2);
  assert.equal(getOwnedDrones(game, tank.id).length, 4);
});

test("fire input commands drones and release recalls them", () => {
  const game = createTinyGame();
  const tank = createOverseer(game);
  stepFor(game, 0.1);
  const drone = getOwnedDrones(game, tank.id)[0];

  tank.input.fire = true;
  tank.input.aimAngle = 0;
  stepFor(game, 0.2);
  assert.equal(game.drones.get(drone.id).mode, "attack");

  tank.input.fire = false;
  stepFor(game, 0.2);
  assert.match(game.drones.get(drone.id).mode, /orbit|return/);
});

test("drones clean up on owner death and appear in snapshots/debug", () => {
  const game = createTinyGame();
  const tank = createOverseer(game);
  stepFor(game, 0.1);
  assert.equal(getOwnedDrones(game, tank.id).length, 1);

  const snapshot = game.createSnapshot();
  assert.equal(snapshot.drones.length, 1);
  assert.equal(snapshot.tanks.find((entry) => entry.id === tank.id).droneStatus.current, 1);
  assert.equal(snapshot.debug.drones.totalActive, 1);

  game.damageTank(tank, {
    id: "test-hit",
    type: "projectile",
    kind: "bullet",
    ownerId: "enemy",
    ownerName: "Enemy",
    ownerKind: "player",
    damage: 999,
    x: tank.x - 40,
    y: tank.y
  });
  assert.equal(tank.state, "dead");
  assert.equal(getOwnedDrones(game, tank.id).length, 0);
});

test("enemy projectiles can destroy drones without granting drone XP", () => {
  const game = createTinyGame();
  const owner = createOverseer(game);
  const enemy = game.createHumanPlayer("client-2", "Enemy");
  enemy.x = owner.x + 400;
  enemy.y = owner.y;
  stepFor(game, 0.1);
  const drone = getOwnedDrones(game, owner.id)[0];
  const enemyScore = enemy.score;

  const projectile = createProjectile({ id: "projectile-1", owner: enemy, nowMs: game.timeMs, config: game.config });
  Object.assign(projectile, {
    x: drone.x,
    y: drone.y,
    prevX: drone.x,
    prevY: drone.y,
    vx: 0,
    vy: 0,
    damage: drone.maxHp + 10
  });
  game.projectiles.set(projectile.id, projectile);

  game.resolveProjectileHits();

  assert.equal(game.drones.get(drone.id).state, "dead");
  assert.equal(enemy.score, enemyScore);
});

test("drone contact damages shapes and credits owner kills", () => {
  const game = createTinyGame();
  const owner = createOverseer(game);
  stepFor(game, 0.1);
  const drone = getOwnedDrones(game, owner.id)[0];
  const shape = createShape({ id: "shape-1", shapeType: "square", x: drone.x, y: drone.y, config: game.config });
  shape.hp = 5;
  game.shapes.set(shape.id, shape);
  game.rebuildSpatialIndex();

  resolveDroneContactDamage(game, 0.1);

  assert.equal(shape.state, "dead");
  assert.ok(owner.score > 0);
});

test("necromancer converts normal killed shapes but not event or Alpha shapes", () => {
  const game = createTinyGame({ rng: () => 0 });
  const necro = createOverseer(game);
  assert.equal(selectTankClass(necro, "necromancer"), true);
  const pentagon = createShape({ id: "pentagon-1", shapeType: "pentagon", x: necro.x + 40, y: necro.y, config: game.config });
  pentagon.hp = 1;
  game.shapes.set(pentagon.id, pentagon);

  game.damageShape(pentagon, {
    id: "necro-test",
    type: "projectile",
    kind: "bullet",
    ownerId: necro.id,
    ownerName: necro.name,
    ownerKind: necro.kind,
    damage: 10,
    x: pentagon.x,
    y: pentagon.y
  });

  assert.equal(getOwnedDrones(game, necro.id).filter((drone) => drone.converted).length, 2);

  const eventShape = createShape({ id: "event-1", shapeType: "triangle", x: necro.x + 60, y: necro.y, config: game.config });
  eventShape.isEventObjective = true;
  eventShape.hp = 1;
  game.damageShape(eventShape, {
    id: "event-hit",
    type: "projectile",
    kind: "bullet",
    ownerId: necro.id,
    ownerName: necro.name,
    ownerKind: necro.kind,
    damage: 10,
    x: eventShape.x,
    y: eventShape.y
  });

  assert.equal(getOwnedDrones(game, necro.id).filter((drone) => drone.converted).length, 2);
});

test("hive lord rebuilds five base drones and converts up to ultimate swarm cap", () => {
  const game = createTinyGame({ rng: () => 0 });
  const hive = createOverseer(game);
  assert.equal(selectTankClass(hive, "necromancer"), true);
  assert.equal(game.selectTankClass(hive.id, "hiveLord"), true);

  stepFor(game, 0.1);
  stepFor(game, 2.5);
  stepFor(game, 2.5);
  stepFor(game, 2.5);
  stepFor(game, 2.5);
  stepFor(game, 2.5);
  assert.equal(getOwnedDrones(game, hive.id).filter((drone) => !drone.converted).length, 5);

  for (let index = 0; index < 4; index += 1) {
    const pentagon = createShape({
      id: `pentagon-${index}`,
      shapeType: "pentagon",
      x: hive.x + 40 + index * 20,
      y: hive.y,
      config: game.config
    });
    pentagon.hp = 1;
    game.shapes.set(pentagon.id, pentagon);
    game.damageShape(pentagon, {
      id: `hive-hit-${index}`,
      type: "projectile",
      kind: "bullet",
      ownerId: hive.id,
      ownerName: hive.name,
      ownerKind: hive.kind,
      damage: 10,
      x: pentagon.x,
      y: pentagon.y
    });
  }

  assert.equal(getOwnedDrones(game, hive.id).length, 10);
  assert.equal(getOwnedDrones(game, hive.id).filter((drone) => drone.converted).every((drone) => drone.expiresAtMs - drone.spawnedAtMs === 16000), true);
});

function createOverseer(game) {
  const tank = game.createHumanPlayer(`client-${game.tanks.size + 1}`, "Bank");
  tank.level = 60;
  assert.equal(selectTankClass(tank, "sniper"), true);
  assert.equal(selectTankClass(tank, "overseer"), true);
  return tank;
}

function getOwnedDrones(game, ownerId) {
  return [...game.drones.values()].filter((drone) => drone.ownerId === ownerId && drone.state === "active");
}

function stepFor(game, seconds) {
  game.step(seconds);
}

function createTinyGame({ rng = () => 0.5 } = {}) {
  const config = JSON.parse(JSON.stringify(GAME_CONFIG));
  config.shapes.targetCount = 0;
  config.bots.baseCount = 0;
  config.bots.perHuman = 0;
  return new ServerGame({ config, rng });
}
