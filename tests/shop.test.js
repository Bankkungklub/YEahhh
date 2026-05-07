import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AccountStore } from "../server/src/accountStore.js";
import { AuthService } from "../server/src/authService.js";
import { ShopService } from "../server/src/shopService.js";

function createShopFixture() {
  const dir = mkdtempSync(join(tmpdir(), "tank-shop-"));
  const store = new AccountStore({ filePath: join(dir, "accounts.json") });
  const auth = new AuthService({ store });
  const shop = new ShopService({ store });
  const account = auth.register({ username: "Bank", password: "password123" }).account;
  return {
    dir,
    store,
    shop,
    account,
    cleanup: () => rmSync(dir, { recursive: true, force: true })
  };
}

test("new account has default cosmetics and can browse catalog", () => {
  const fixture = createShopFixture();
  try {
    const catalog = fixture.shop.getCatalog(fixture.account);
    assert.ok(catalog.items.find((item) => item.id === "body-blue").owned);
    assert.ok(catalog.items.find((item) => item.id === "outline-dark").owned);
    assert.equal(catalog.account.coins, 120);
  } finally {
    fixture.cleanup();
  }
});

test("buying and equipping cosmetics updates account state", () => {
  const fixture = createShopFixture();
  try {
    const bought = fixture.shop.buyItem(fixture.account.id, "body-red");
    assert.equal(bought.coins, 40);
    assert.ok(bought.inventory.includes("body-red"));

    const equipped = fixture.shop.equipItem(fixture.account.id, "body-red");
    assert.equal(equipped.equipped.bodyColor, "body-red");
    assert.equal(equipped.loadout.bodyColor, "#f25f4c");
  } finally {
    fixture.cleanup();
  }
});

test("shop prevents unaffordable or unowned equips", () => {
  const fixture = createShopFixture();
  try {
    assert.throws(() => fixture.shop.buyItem(fixture.account.id, "badge-star"), /Not enough/);
    assert.throws(() => fixture.shop.equipItem(fixture.account.id, "badge-star"), /not owned/);
  } finally {
    fixture.cleanup();
  }
});
