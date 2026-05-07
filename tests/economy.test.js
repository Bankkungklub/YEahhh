import test from "node:test";
import assert from "node:assert/strict";
import { coinsForShape, coinsForTankKill, applyMatchCoinCap } from "../shared/sim/economy.js";
import { validateAppConfig } from "../shared/config/appConfig.js";
import { validateShopCatalog } from "../shared/config/shopCatalog.js";

test("app config and shop catalog validate", () => {
  assert.deepEqual(validateAppConfig(), []);
  assert.deepEqual(validateShopCatalog(), []);
});

test("coin formulas match shape and tank reward rules", () => {
  assert.equal(coinsForShape(8), 1);
  assert.equal(coinsForShape(18), 2);
  assert.equal(coinsForShape(45), 5);
  assert.equal(coinsForTankKill({ kind: "bot", level: 3 }), 12);
  assert.equal(coinsForTankKill({ kind: "player", level: 3 }), 18);
});

test("match coin soft cap reduces rewards after cap", () => {
  assert.equal(applyMatchCoinCap(0, 100), 100);
  assert.equal(applyMatchCoinCap(390, 20), 12);
  assert.equal(applyMatchCoinCap(400, 20), 5);
});
