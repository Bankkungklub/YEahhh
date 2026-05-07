import test from "node:test";
import assert from "node:assert/strict";
import {
  createMenuViewModel,
  getJoinButtonLabel,
  getMenuStatus,
  readStorageValue,
  sanitizeMenuName,
  writeStorageValue
} from "../client/src/ui/menuViewModel.js";
import { MENU_CONFIG } from "../client/src/ui/menuConfig.js";

test("menu view model exposes idle status and enabled join button", () => {
  const view = createMenuViewModel({ screen: "menu", error: "" });

  assert.equal(view.visible, true);
  assert.equal(view.buttonDisabled, false);
  assert.equal(view.buttonLabel, MENU_CONFIG.joinLabel);
  assert.equal(view.statusText, MENU_CONFIG.idleStatus);
  assert.equal(view.statusTone, "ready");
});

test("connecting state disables join and uses connecting copy", () => {
  const view = createMenuViewModel({ screen: "connecting", error: "old error" });

  assert.equal(view.visible, true);
  assert.equal(view.buttonDisabled, true);
  assert.equal(view.buttonLabel, MENU_CONFIG.connectingLabel);
  assert.equal(view.statusText, MENU_CONFIG.connectingStatus);
  assert.equal(view.statusTone, "pending");
});

test("checking state disables join and uses server status copy", () => {
  const view = createMenuViewModel({ screen: "checking", error: "" });

  assert.equal(view.visible, true);
  assert.equal(view.buttonDisabled, true);
  assert.equal(view.buttonLabel, MENU_CONFIG.checkingLabel);
  assert.equal(view.statusText, MENU_CONFIG.checkingStatus);
  assert.equal(view.statusTone, "pending");
});

test("menu error state shows error tone and readable status", () => {
  const view = createMenuViewModel({ screen: "menu", error: "Server is full." });

  assert.equal(view.statusText, "Server is full.");
  assert.equal(view.statusTone, "error");
});

test("menu helpers sanitize names and guard storage", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value)
  };
  const brokenStorage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    }
  };

  assert.equal(sanitizeMenuName("   "), MENU_CONFIG.defaultName);
  assert.equal(sanitizeMenuName("  Captain Long Name Here  "), "Captain Long Nam");
  assert.equal(writeStorageValue(storage, "name", "Bank"), true);
  assert.equal(readStorageValue(storage, "name", ""), "Bank");
  assert.equal(readStorageValue(brokenStorage, "name", "Fallback"), "Fallback");
  assert.equal(writeStorageValue(brokenStorage, "name", "Bank"), false);
});

test("standalone label/status helpers match view model decisions", () => {
  assert.equal(getMenuStatus({ screen: "menu", error: "" }), MENU_CONFIG.idleStatus);
  assert.equal(getJoinButtonLabel({ screen: "connecting" }), MENU_CONFIG.connectingLabel);
});
