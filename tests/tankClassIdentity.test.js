import test from "node:test";
import assert from "node:assert/strict";
import { ServerGame } from "../server/src/serverGame.js";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";
import { TANK_CLASS_CONFIG } from "../shared/config/tankClassConfig.js";
import { TANK_CLASS_IDENTITY_CONFIG } from "../shared/config/tankClassIdentityConfig.js";
import {
  getClassChoiceIdentityViewModel,
  getProjectileFeedbackProfile,
  getTankClassIdentitySummary,
  validateTankClassIdentityConfig
} from "../shared/sim/tankClassIdentity.js";

test("tank class identity metadata covers every active class", () => {
  assert.deepEqual(validateTankClassIdentityConfig(), []);
  const activeClassIds = Object.values(TANK_CLASS_CONFIG.classes)
    .filter((tankClass) => tankClass.active)
    .map((tankClass) => tankClass.id)
    .sort();
  assert.deepEqual(Object.keys(TANK_CLASS_IDENTITY_CONFIG).sort(), activeClassIds);
});

test("class identity summaries expose role and feedback profile", () => {
  const summary = getTankClassIdentitySummary("missileCommand");

  assert.equal(summary.name, "Missile Command");
  assert.equal(summary.feedbackProfile, "missile");
  assert.equal(summary.unlockLevel, 60);
  assert.ok(summary.feelTags.includes("missile"));
});

test("important class fantasy contracts stay semantic instead of count-only", () => {
  const expectations = {
    overseer: "drone",
    overlord: "drone",
    necromancer: "drone",
    hiveLord: "drone",
    trapper: "trap",
    minefield: "trap",
    aegisBastion: "trap",
    missileCommand: "missile",
    stormcaller: "storm",
    siegeCore: "heavy",
    comet: "booster",
    streamliner: "rapid"
  };

  for (const [classId, profile] of Object.entries(expectations)) {
    assert.equal(getClassChoiceIdentityViewModel(classId).feedbackProfile, profile, classId);
  }
});

test("projectiles carry compact feedback profile metadata with a kind fallback", () => {
  const game = createTinyGame();
  const tank = game.createHumanPlayer("client-1", "Bank");
  tank.classId = "missileCommand";
  tank.level = 60;

  game.spawnProjectile(tank);
  const projectile = [...game.projectiles.values()][0];
  const snapshotProjectile = game.createSnapshot().projectiles.find((candidate) => candidate.id === projectile.id);

  assert.equal(projectile.ownerClassId, "missileCommand");
  assert.equal(projectile.feedbackProfile, "missile");
  assert.equal(snapshotProjectile.ownerClassId, "missileCommand");
  assert.equal(snapshotProjectile.feedbackProfile, "missile");
  assert.equal(getProjectileFeedbackProfile({ kind: "rocket", behavior: "rocket" }), "rocket");
});

function createTinyGame() {
  const config = JSON.parse(JSON.stringify(GAME_CONFIG));
  config.shapes.targetCount = 0;
  config.bots.baseCount = 0;
  config.bots.perHuman = 0;
  return new ServerGame({ config, rng: () => 0.5 });
}
