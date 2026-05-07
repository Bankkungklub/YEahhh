import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { APP_CONFIG } from "../shared/config/appConfig.js";
import { GAME_CONFIG } from "../shared/config/gameConfig.js";
import { getTotalUpgradeBudgetForLevel } from "../shared/sim/progression.js";
import { AccountStore } from "../server/src/accountStore.js";
import { AuthService } from "../server/src/authService.js";
import { isDeveloperAccount, seedDeveloperAdminAccount } from "../server/src/developerAdmin.js";
import { RoomManager } from "../server/src/roomManager.js";

function createTempStore() {
  const dir = mkdtempSync(join(tmpdir(), "tank-dev-admin-"));
  const store = new AccountStore({ filePath: join(dir, "accounts.json") });
  return {
    dir,
    store,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

function createTestConfig() {
  const config = JSON.parse(JSON.stringify(GAME_CONFIG));
  config.shapes.targetCount = 0;
  config.bots.baseCount = 0;
  config.bots.perHuman = 0;
  return config;
}

test("developer admin seed creates a hashed developer account that can log in", () => {
  const fixture = createTempStore();
  try {
    const account = seedDeveloperAdminAccount({ store: fixture.store, nodeEnv: "development" });
    const raw = fixture.store.getAccountByUsername("Admin");
    const auth = new AuthService({ store: fixture.store });
    const login = auth.login({ username: "Admin", password: "123456@@##$$" });

    assert.equal(account.username, "Admin");
    assert.equal(account.role, "developer");
    assert.equal(account.isDeveloper, true);
    assert.notEqual(raw.passwordHash, "123456@@##$$");
    assert.equal(raw.passwordHash, APP_CONFIG.developer.adminAccount.passwordHash);
    assert.equal(login.account.username, "Admin");
    assert.equal(isDeveloperAccount(login.account), true);
  } finally {
    fixture.cleanup();
  }
});

test("developer admin seed is disabled in production mode", () => {
  const fixture = createTempStore();
  try {
    const account = seedDeveloperAdminAccount({ store: fixture.store, nodeEnv: "production" });

    assert.equal(account, null);
    assert.equal(fixture.store.getAccountByUsername("Admin"), null);
  } finally {
    fixture.cleanup();
  }
});

test("developer level tool sets only the active developer account tank", () => {
  const config = createTestConfig();
  const manager = new RoomManager({ config });
  const room = manager.getOrCreatePublicRoom();
  const adminTank = room.game.createHumanPlayer("client-admin", "Admin", {
    account: { id: "acct-admin", username: "Admin", role: "developer", isDeveloper: true }
  });
  const otherTank = room.game.createHumanPlayer("client-other", "Other", {
    account: { id: "acct-other", username: "Other" }
  });

  const result = manager.applyDeveloperLevel("acct-admin", 60);

  assert.equal(result.ok, true);
  assert.equal(result.updated.length, 1);
  assert.equal(adminTank.level, 60);
  assert.equal(adminTank.xp, 0);
  assert.equal(adminTank.upgradePoints, getTotalUpgradeBudgetForLevel(60));
  assert.deepEqual(adminTank.upgrades, {
    maxHealth: 0,
    regen: 0,
    bulletDamage: 0,
    bulletSpeed: 0,
    reload: 0,
    moveSpeed: 0
  });
  assert.deepEqual(adminTank.classUnlockChoices.sort(), ["flankGuard", "machineGun", "sniper", "twin"]);
  assert.equal(adminTank.hp, adminTank.maxHp);
  assert.equal(otherTank.level, 1);
});
