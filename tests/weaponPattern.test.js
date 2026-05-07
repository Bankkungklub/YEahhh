import test from "node:test";
import assert from "node:assert/strict";
import { ServerGame } from "../server/src/serverGame.js";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";
import { TANK_CLASS_CONFIG, validateTankClassConfig } from "../shared/config/tankClassConfig.js";
import { selectTankClass } from "../shared/sim/tankClasses.js";

test("basic class fires one projectile", () => {
  const game = createTinyGame();
  const tank = game.createHumanPlayer("client-1", "Bank");

  game.spawnProjectile(tank);

  assert.equal(game.projectiles.size, 1);
});

test("twin class fires two forward projectiles", () => {
  const game = createTinyGame();
  const tank = game.createHumanPlayer("client-1", "Bank");
  tank.level = 15;
  assert.equal(selectTankClass(tank, "twin"), true);

  game.spawnProjectile(tank);

  assert.equal(game.projectiles.size, 2);
  const bullets = [...game.projectiles.values()];
  assert.notEqual(bullets[0].y, bullets[1].y);
});

test("flank guard fires front and rear projectiles", () => {
  const game = createTinyGame();
  const tank = game.createHumanPlayer("client-1", "Bank");
  tank.level = 15;
  tank.aimAngle = 0;
  assert.equal(selectTankClass(tank, "flankGuard"), true);

  game.spawnProjectile(tank);

  assert.equal(game.projectiles.size, 2);
  const velocities = [...game.projectiles.values()].map((projectile) => Math.sign(projectile.vx)).sort();
  assert.deepEqual(velocities, [-1, 1]);
});

test("full tree classes spawn their configured projectile counts or drone commands", () => {
  const expectedCounts = {
    tripleShot: 3,
    quadTank: 4,
    twinFlank: 4,
    triAngle: 3,
    assassin: 1,
    overseer: 0,
    hunter: 2,
    destroyer: 1,
    gunner: 4,
    triplet: 3,
    pentaShot: 5,
    octoTank: 8,
    tripleTwin: 6,
    stalker: 1,
    overlord: 0,
    necromancer: 0,
    booster: 3,
    fighter: 5,
    predator: 1,
    streamliner: 5,
    annihilator: 1,
    hybrid: 3,
    autoGunner: 5,
    sprayer: 7,
    fireworkTank: 1,
    starburst: 1,
    trapper: 1,
    minefield: 3,
    rammer: 1,
    spike: 1,
    missileCommand: 3,
    stormcaller: 8,
    siegeCore: 1,
    hiveLord: 0,
    aegisBastion: 5,
    comet: 6
  };

  for (const [classId, expectedCount] of Object.entries(expectedCounts)) {
    const game = createTinyGame();
    const tank = game.createHumanPlayer("client-1", "Bank");
    tank.classId = classId;
    tank.level = 60;
    tank.aimAngle = 0;

    game.spawnProjectile(tank);
    flushPendingWeaponShots(game);

    assert.equal(game.projectiles.size, expectedCount, `${classId} projectile count`);
  }
});

test("weapon pattern delayMs defaults and validates as bounded burst timing", () => {
  for (const pattern of Object.values(TANK_CLASS_CONFIG.weaponPatterns)) {
    for (const shot of pattern) {
      assert.equal(Number.isInteger(shot.delayMs), true);
      assert.ok(shot.delayMs >= 0 && shot.delayMs <= 260);
    }
  }

  const invalid = JSON.parse(JSON.stringify(TANK_CLASS_CONFIG));
  invalid.weaponPatterns.single[0].delayMs = 261;

  assert.ok(validateTankClassConfig(invalid).some((issue) => issue.includes("invalid delayMs")));
});

test("rapid branch fires timed sprays without changing count or damage budget", () => {
  const expectations = {
    gunner: { delays: [0, 28, 56, 84], damageSum: 1.8 },
    autoGunner: { delays: [0, 24, 48, 72, 96], damageSum: 1.72 },
    sprayer: { delays: [0, 20, 40, 60, 80, 100, 120], damageSum: 1.96 }
  };

  for (const [classId, expected] of Object.entries(expectations)) {
    const pattern = TANK_CLASS_CONFIG.weaponPatterns[classId];
    assert.deepEqual(pattern.map((shot) => shot.delayMs), expected.delays, `${classId} delay cadence`);
    assert.equal(sumDamage(pattern), expected.damageSum, `${classId} damage budget`);

    const game = createTinyGame();
    const tank = game.createHumanPlayer(`client-${classId}`, "Bank");
    tank.classId = classId;
    tank.level = 60;
    tank.aimAngle = 0;
    game.spawnProjectile(tank);
    flushPendingWeaponShots(game);

    const createdAt = [...game.projectiles.values()]
      .sort((a, b) => a.createdAtMs - b.createdAtMs)
      .map((projectile) => Math.round(projectile.createdAtMs));
    assert.deepEqual(createdAt, expected.delays, `${classId} emitted cadence`);
  }
});

test("streamliner fires a straight timed forward stream", () => {
  const game = createTinyGame();
  const tank = game.createHumanPlayer("client-1", "Bank");
  tank.classId = "streamliner";
  tank.level = 45;
  tank.aimAngle = 0;

  game.spawnProjectile(tank);

  assert.equal(game.projectiles.size, 1);
  assert.equal(game.pendingWeaponShots.length, 4);

  game.step(0.044);
  assert.equal(game.projectiles.size, 1);

  for (const dtSeconds of [0.001, 0.045, 0.045, 0.045]) {
    game.step(dtSeconds);
  }

  const bullets = [...game.projectiles.values()]
    .filter((projectile) => projectile.ownerId === tank.id)
    .sort((a, b) => a.createdAtMs - b.createdAtMs);

  assert.equal(bullets.length, 5);
  assert.deepEqual(bullets.map((projectile) => Math.round(projectile.createdAtMs)), [0, 45, 90, 135, 180]);
  assert.equal(bullets.every((projectile) => projectile.angleOffset === 0), true);
  assert.equal(bullets.every((projectile) => projectile.lateralOffset === 0), true);
  assert.equal(bullets.every((projectile) => Math.abs(projectile.angle) < 0.0001), true);
});

test("streamliner queued shots cancel when owner state is no longer valid", () => {
  const deadGame = createTinyGame();
  const deadTank = deadGame.createHumanPlayer("client-1", "Bank");
  deadTank.classId = "streamliner";
  deadGame.spawnProjectile(deadTank);
  deadTank.state = "dead";
  deadGame.step(0.2);
  assert.equal(deadGame.pendingWeaponShots.length, 0);
  assert.equal(deadGame.projectiles.size, 1);

  const classGame = createTinyGame();
  const classTank = classGame.createHumanPlayer("client-2", "Bank");
  classTank.classId = "streamliner";
  classGame.spawnProjectile(classTank);
  classTank.classId = "basic";
  classGame.step(0.2);
  assert.equal(classGame.pendingWeaponShots.length, 0);
  assert.equal(classGame.projectiles.size, 1);

  const disconnectGame = createTinyGame();
  const disconnectTank = disconnectGame.createHumanPlayer("client-3", "Bank");
  disconnectTank.classId = "streamliner";
  disconnectGame.spawnProjectile(disconnectTank);
  disconnectGame.markDisconnected("client-3");
  assert.equal(disconnectGame.pendingWeaponShots.length, 0);
});

test("control branch classes stay locked to drone commands instead of stale projectile patterns", () => {
  for (const classId of ["overseer", "overlord", "necromancer", "hiveLord"]) {
    const tankClass = TANK_CLASS_CONFIG.classes[classId];
    assert.equal(tankClass.weaponPattern, "none");
    assert.equal(typeof tankClass.droneLoadoutId, "string");
    assert.equal(TANK_CLASS_CONFIG.weaponPatterns[classId], undefined);

    const game = createTinyGame();
    const tank = game.createHumanPlayer(`client-${classId}`, classId);
    tank.classId = classId;
    game.spawnProjectile(tank);

    assert.equal(game.projectiles.size, 0);
  }
});

test("level 60 ultimate weapon identities match their configured roles", () => {
  const missileGame = createTinyGame();
  const missileTank = missileGame.createHumanPlayer("client-missile", "Bank");
  missileTank.classId = "missileCommand";
  missileTank.level = 60;
  missileGame.spawnProjectile(missileTank);
  flushPendingWeaponShots(missileGame);
  const missiles = [...missileGame.projectiles.values()].sort((a, b) => a.createdAtMs - b.createdAtMs);
  assert.equal(missiles.length, 3);
  assert.equal(missiles.every((projectile) => projectile.kind === "rocket" && projectile.behavior === "missile"), true);
  assert.deepEqual(missiles.map((projectile) => Math.round(projectile.createdAtMs)), [0, 70, 140]);

  const stormGame = createTinyGame();
  const stormTank = stormGame.createHumanPlayer("client-storm", "Bank");
  stormTank.classId = "stormcaller";
  stormTank.level = 60;
  stormGame.spawnProjectile(stormTank);
  flushPendingWeaponShots(stormGame);
  const stormShots = [...stormGame.projectiles.values()].sort((a, b) => a.createdAtMs - b.createdAtMs);
  assert.equal(stormShots.length, 8);
  assert.deepEqual(stormShots.map((projectile) => Math.round(projectile.createdAtMs)), [0, 25, 50, 75, 100, 125, 150, 175]);

  const aegisGame = createTinyGame();
  const aegisTank = aegisGame.createHumanPlayer("client-aegis", "Bank");
  aegisTank.classId = "aegisBastion";
  aegisTank.level = 60;
  aegisGame.spawnProjectile(aegisTank);
  assert.equal([...aegisGame.projectiles.values()].every((projectile) => projectile.kind === "trap"), true);
});

test("heavy and sniper final classes apply projectile radius and ttl modifiers", () => {
  const game = createTinyGame();
  const destroyer = game.createHumanPlayer("client-1", "Bank");
  destroyer.classId = "destroyer";
  game.spawnProjectile(destroyer);
  const shell = [...game.projectiles.values()][0];
  assert.ok(shell.radius > GAME_CONFIG.projectile.radius);

  const game2 = createTinyGame();
  const stalker = game2.createHumanPlayer("client-1", "Bank");
  stalker.classId = "stalker";
  game2.spawnProjectile(stalker);
  const bullet = [...game2.projectiles.values()][0];
  assert.ok(bullet.ttlMs > GAME_CONFIG.projectile.ttlMs);

  const game3 = createTinyGame();
  const annihilator = game3.createHumanPlayer("client-1", "Bank");
  annihilator.classId = "annihilator";
  game3.spawnProjectile(annihilator);
  const massiveShell = [...game3.projectiles.values()][0];
  assert.ok(massiveShell.radius > shell.radius);

  const game4 = createTinyGame();
  const predator = game4.createHumanPlayer("client-1", "Bank");
  predator.classId = "predator";
  game4.spawnProjectile(predator);
  const predatorBullet = [...game4.projectiles.values()][0];
  assert.ok(predatorBullet.ttlMs > GAME_CONFIG.projectile.ttlMs);

  const game5 = createTinyGame();
  const starburst = game5.createHumanPlayer("client-1", "Bank");
  starburst.classId = "starburst";
  game5.spawnProjectile(starburst);
  const rocket = [...game5.projectiles.values()][0];
  assert.equal(rocket.kind, "rocket");

  const game6 = createTinyGame();
  const trapper = game6.createHumanPlayer("client-1", "Bank");
  trapper.classId = "trapper";
  game6.spawnProjectile(trapper);
  const trap = [...game6.projectiles.values()][0];
  assert.equal(trap.kind, "trap");
});

function createTinyGame() {
  const config = JSON.parse(JSON.stringify(GAME_CONFIG));
  config.shapes.targetCount = 0;
  config.bots.baseCount = 0;
  config.bots.perHuman = 0;
  return new ServerGame({ config, rng: () => 0.5 });
}

function flushPendingWeaponShots(game) {
  let guard = 20;
  while (game.pendingWeaponShots.length > 0 && guard > 0) {
    guard -= 1;
    const nextAtMs = Math.min(...game.pendingWeaponShots.map((shot) => shot.spawnAtMs));
    const dtMs = Math.max(0, nextAtMs - game.timeMs);
    game.step(dtMs / 1000);
  }
  assert.equal(game.pendingWeaponShots.length, 0, "pending weapon shots should flush");
}

function sumDamage(pattern) {
  return Math.round(pattern.reduce((sum, shot) => sum + shot.damageMultiplier, 0) * 100) / 100;
}
