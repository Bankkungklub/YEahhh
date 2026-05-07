import test from "node:test";
import assert from "node:assert/strict";
import { GAME_CONFIG, UPGRADE_KEYS, getTankStats } from "../shared/config/gameConfig.js";
import { getDroneLoadout } from "../shared/config/droneConfig.js";
import { getClassAdjustedTankStats } from "../shared/sim/tankClasses.js";
import {
  getUpgradePreview,
  getUpgradePreviewViewModel
} from "../shared/sim/upgradePreview.js";

test("upgrade previews mirror shared tank stat formulas for bullet classes", () => {
  const tank = createTank({ classId: "basic" });
  const beforeStats = getClassAdjustedTankStats(getTankStats(tank.upgrades), tank.classId);

  for (const key of UPGRADE_KEYS) {
    const preview = getUpgradePreview({ localTank: tank, key });
    const afterStats = getClassAdjustedTankStats(
      getTankStats({ ...tank.upgrades, [key]: 1 }),
      tank.classId
    );

    assert.equal(preview.level, 0);
    assert.equal(preview.maxed, false);
    assert.equal(preview.applies, true);

    if (key === "maxHealth") {
      assert.equal(preview.beforeValue, beforeStats.maxHp);
      assert.equal(preview.afterValue, afterStats.maxHp);
      assert.equal(preview.summary, "HP 100 -> 118");
    }
    if (key === "regen") {
      assert.equal(preview.beforeValue, beforeStats.regenPerSecond);
      assert.equal(preview.afterValue, afterStats.regenPerSecond);
      assert.equal(preview.secondaryBeforeValue, beforeStats.regenDelayMs);
      assert.equal(preview.secondaryAfterValue, afterStats.regenDelayMs);
    }
    if (key === "bulletDamage") {
      assert.equal(preview.beforeValue, beforeStats.bulletDamage);
      assert.equal(preview.afterValue, afterStats.bulletDamage);
    }
    if (key === "bulletSpeed") {
      assert.equal(preview.beforeValue, beforeStats.bulletSpeed);
      assert.equal(preview.afterValue, afterStats.bulletSpeed);
    }
    if (key === "reload") {
      assert.equal(preview.beforeValue, beforeStats.reloadMs);
      assert.equal(preview.afterValue, afterStats.reloadMs);
      assert.ok(preview.afterValue < preview.beforeValue);
    }
    if (key === "moveSpeed") {
      assert.equal(preview.beforeValue, beforeStats.moveSpeed);
      assert.equal(preview.afterValue, afterStats.moveSpeed);
    }
  }
});

test("maxed upgrade preview reports a stable max state", () => {
  const tank = createTank({
    upgrades: {
      ...zeroUpgrades(),
      reload: GAME_CONFIG.upgrades.maxLevel
    }
  });
  const preview = getUpgradePreview({ localTank: tank, key: "reload" });

  assert.equal(preview.level, GAME_CONFIG.upgrades.maxLevel);
  assert.equal(preview.maxed, true);
  assert.equal(preview.summary, "MAX");
  assert.equal(preview.valueKind, "maxed");
});

test("drone class previews show drone-specific effects and honest non-effects", () => {
  const tank = createTank({ classId: "overseer" });
  const loadout = getDroneLoadout("overseer");
  const baseDamage = GAME_CONFIG.projectile.baseDamage;
  const damagePreview = getUpgradePreview({ localTank: tank, key: "bulletDamage" });
  const reloadPreview = getUpgradePreview({ localTank: tank, key: "reload" });
  const speedPreview = getUpgradePreview({ localTank: tank, key: "bulletSpeed" });
  const beforeStats = getClassAdjustedTankStats(getTankStats(tank.upgrades), tank.classId);
  const afterDamageStats = getClassAdjustedTankStats(
    getTankStats({ ...tank.upgrades, bulletDamage: 1 }),
    tank.classId
  );

  assert.equal(damagePreview.valueKind, "droneDamage");
  assert.equal(damagePreview.beforeValue, loadout.bodyDamage * (beforeStats.bulletDamage / baseDamage));
  assert.equal(damagePreview.afterValue, loadout.bodyDamage * (afterDamageStats.bulletDamage / baseDamage));
  assert.match(damagePreview.summary, /^Drone DMG /);

  assert.equal(reloadPreview.valueKind, "droneRebuildMs");
  assert.ok(reloadPreview.afterValue < reloadPreview.beforeValue);
  assert.match(reloadPreview.summary, /^Rebuild /);

  assert.equal(speedPreview.applies, false);
  assert.equal(speedPreview.valueKind, "noDirectDroneEffect");
  assert.equal(speedPreview.summary, "No direct drone effect");
});

test("upgrade preview view model returns labeled entries for every upgrade key", () => {
  const tank = createTank();
  const previews = getUpgradePreviewViewModel({
    localTank: tank,
    labels: { ...GAME_CONFIG.upgrades.labels, reload: "Reload Time" }
  });

  assert.equal(previews.length, UPGRADE_KEYS.length);
  assert.deepEqual(previews.map((preview) => preview.key), UPGRADE_KEYS);
  assert.equal(previews.find((preview) => preview.key === "reload").label, "Reload Time");
  for (const preview of previews) {
    assert.equal(typeof preview.summary, "string");
    assert.ok(preview.summary.length > 0);
  }
});

function createTank({ classId = "basic", upgrades = zeroUpgrades() } = {}) {
  return {
    id: "tank-1",
    state: "alive",
    classId,
    upgradePoints: 3,
    upgrades
  };
}

function zeroUpgrades() {
  return Object.fromEntries(UPGRADE_KEYS.map((key) => [key, 0]));
}
