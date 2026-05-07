import test from "node:test";
import assert from "node:assert/strict";
import { ServerGame } from "../server/src/serverGame.js";
import { COMBAT_FEEL_CONFIG } from "../shared/config/combatFeelConfig.js";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";

test("armed hostile traps block bullets and consume trap hit budget", () => {
  const game = createTinyGame();
  const trap = createProjectile({
    id: "trap-1",
    kind: "trap",
    behavior: "trap",
    ownerId: "trapper",
    armed: true,
    remainingHits: 3,
    hitCooldowns: {},
    radius: 18
  });
  const bullet = createProjectile({
    id: "bullet-1",
    ownerId: "enemy",
    x: trap.x,
    y: trap.y
  });

  game.projectiles.set(trap.id, trap);
  game.projectiles.set(bullet.id, bullet);

  game.resolveProjectileHits();

  assert.equal(bullet.state, "expired");
  assert.equal(trap.remainingHits, 2);
  assert.equal(trap.state, "active");
  assert.equal(game.performanceStats.trapBlocks, 1);
});

test("unarmed traps and friendly traps do not block projectiles", () => {
  const unarmedGame = createTinyGame();
  const unarmedTrap = createProjectile({
    id: "trap-1",
    kind: "trap",
    behavior: "trap",
    ownerId: "trapper",
    armed: false,
    remainingHits: 3,
    hitCooldowns: {},
    radius: 18
  });
  const hostileBullet = createProjectile({
    id: "bullet-1",
    ownerId: "enemy",
    x: unarmedTrap.x,
    y: unarmedTrap.y
  });
  unarmedGame.projectiles.set(unarmedTrap.id, unarmedTrap);
  unarmedGame.projectiles.set(hostileBullet.id, hostileBullet);
  unarmedGame.resolveProjectileHits();

  assert.equal(hostileBullet.state, "active");
  assert.equal(unarmedTrap.remainingHits, 3);

  const friendlyGame = createTinyGame();
  const friendlyTrap = createProjectile({
    id: "trap-2",
    kind: "trap",
    behavior: "trap",
    ownerId: "trapper",
    armed: true,
    remainingHits: 3,
    hitCooldowns: {},
    radius: 18
  });
  const friendlyBullet = createProjectile({
    id: "bullet-2",
    ownerId: "trapper",
    x: friendlyTrap.x,
    y: friendlyTrap.y
  });
  friendlyGame.projectiles.set(friendlyTrap.id, friendlyTrap);
  friendlyGame.projectiles.set(friendlyBullet.id, friendlyBullet);
  friendlyGame.resolveProjectileHits();

  assert.equal(friendlyBullet.state, "active");
  assert.equal(friendlyTrap.remainingHits, 3);
});

test("traps expire after blocking enough hostile projectiles", () => {
  const game = createTinyGame();
  const trap = createProjectile({
    id: "trap-1",
    kind: "trap",
    behavior: "trap",
    ownerId: "trapper",
    armed: true,
    remainingHits: 1,
    hitCooldowns: {},
    radius: 18
  });
  const bullet = createProjectile({
    id: "bullet-1",
    ownerId: "enemy",
    x: trap.x,
    y: trap.y
  });

  game.projectiles.set(trap.id, trap);
  game.projectiles.set(bullet.id, bullet);
  game.resolveProjectileHits();

  assert.equal(bullet.state, "expired");
  assert.equal(trap.state, "expired");
});

test("trap-blocked rockets detonate exactly once at the block point", () => {
  const game = createTinyGame();
  const trap = createProjectile({
    id: "trap-1",
    kind: "trap",
    behavior: "trap",
    ownerId: "trapper",
    armed: true,
    remainingHits: 3,
    hitCooldowns: {},
    radius: 18
  });
  const rocket = createProjectile({
    id: "rocket-1",
    kind: "rocket",
    behavior: "rocket",
    ownerId: "enemy",
    x: trap.x,
    y: trap.y,
    damage: 40,
    radius: 9
  });

  game.projectiles.set(trap.id, trap);
  game.projectiles.set(rocket.id, rocket);
  game.resolveProjectileHits();

  const sparks = [...game.projectiles.values()].filter((projectile) => projectile.kind === "spark");
  assert.equal(rocket.state, "expired");
  assert.equal(rocket.detonated, true);
  assert.equal(sparks.length, COMBAT_FEEL_CONFIG.projectileBehaviors.rocket.sparkCount);

  game.detonateProjectile(rocket);
  const sparksAfterSecondDetonate = [...game.projectiles.values()].filter((projectile) => projectile.kind === "spark");
  assert.equal(sparksAfterSecondDetonate.length, sparks.length);
});

function createTinyGame() {
  const config = JSON.parse(JSON.stringify(GAME_CONFIG));
  config.shapes.targetCount = 0;
  config.bots.baseCount = 0;
  config.bots.perHuman = 0;
  return new ServerGame({ config, rng: () => 0.5 });
}

function createProjectile(overrides = {}) {
  return {
    id: "projectile-1",
    type: "projectile",
    kind: "bullet",
    behavior: "bullet",
    ownerId: "tank-1",
    ownerName: "Tank",
    ownerKind: "player",
    x: 100,
    y: 100,
    prevX: 100,
    prevY: 100,
    vx: 200,
    vy: 0,
    angle: 0,
    radius: 6,
    damage: 20,
    ageMs: 0,
    ttlMs: 1000,
    createdAtMs: 0,
    state: "active",
    ...overrides
  };
}
