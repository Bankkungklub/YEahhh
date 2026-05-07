import test from "node:test";
import assert from "node:assert/strict";
import { DRONE_CONFIG } from "../shared/config/droneConfig.js";
import { TANK_CLASS_CONFIG } from "../shared/config/tankClassConfig.js";
import { getAllDroneBalanceSummaries, getDroneBalanceSummary, validateDroneBalance } from "../shared/sim/droneBalance.js";

test("drone balance summaries stay within configured DPS budgets", () => {
  const summaries = getAllDroneBalanceSummaries({ droneConfig: DRONE_CONFIG });

  assert.equal(summaries.overseer.maxDrones, 2);
  assert.equal(summaries.overlord.maxDrones, 4);
  assert.equal(summaries.necromancer.maxDrones, 8);
  assert.equal(summaries.hiveLord.maxDrones, 10);

  for (const [loadoutId, summary] of Object.entries(summaries)) {
    assert.ok(Number.isFinite(summary.rawDps) && summary.rawDps > 0, `${loadoutId} raw DPS`);
    assert.ok(Number.isFinite(summary.effectiveDps) && summary.effectiveDps > 0, `${loadoutId} effective DPS`);
    assert.ok(summary.effectiveDps >= DRONE_CONFIG.balance.effectiveDpsMin, `${loadoutId} DPS lower budget`);
    assert.ok(summary.effectiveDps <= DRONE_CONFIG.balance.effectiveDpsMax, `${loadoutId} DPS upper budget`);
  }
});

test("drone class ids all map to valid loadout summaries", () => {
  assert.deepEqual(validateDroneBalance({ droneConfig: DRONE_CONFIG, tankConfig: TANK_CLASS_CONFIG }), []);

  for (const tankClass of Object.values(TANK_CLASS_CONFIG.classes).filter((entry) => entry.droneLoadoutId)) {
    const summary = getDroneBalanceSummary(tankClass.id, { droneConfig: DRONE_CONFIG, tankConfig: TANK_CLASS_CONFIG });
    assert.equal(summary.loadoutId, tankClass.droneLoadoutId);
    assert.equal(summary.classId, tankClass.id);
  }
});
