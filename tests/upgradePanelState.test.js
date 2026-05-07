import test from "node:test";
import assert from "node:assert/strict";
import {
  createUpgradePanelState,
  getUpgradePanelViewModel,
  markUpgradePointsChanged,
  shouldHandleUpgradePanelHotkey,
  toggleUpgradePanelState
} from "../client/src/ui/upgradePanelState.js";

test("upgrade panel state loads, toggles, and persists collapsed preference", () => {
  const storage = createMemoryStorage();
  let state = createUpgradePanelState(storage);
  assert.equal(state.collapsed, false);

  state = toggleUpgradePanelState(state, storage);
  assert.equal(state.collapsed, true);
  assert.equal(state.userCollapsed, true);
  assert.equal(storage.getItem("tankArena.upgradePanel.v1"), "collapsed");

  const loaded = createUpgradePanelState(storage);
  assert.equal(loaded.collapsed, true);
});

test("collapsed upgrade view model shows point count and pulse state", () => {
  const model = getUpgradePanelViewModel({
    panelState: { collapsed: true, lastAvailablePoints: 1, pulseUntilMs: 2600 },
    localTank: { state: "alive", upgradePoints: 3 },
    nowMs: 1200
  });

  assert.equal(model.collapsed, true);
  assert.equal(model.label, "UPGRADES +3");
  assert.equal(model.canUpgrade, true);
  assert.equal(model.pulse, true);
});

test("upgrade pulse expires without another point change", () => {
  const state = markUpgradePointsChanged(
    { collapsed: true, userCollapsed: true, lastAvailablePoints: 1, pulseUntilMs: 0 },
    3,
    1000
  );
  assert.equal(state.lastAvailablePoints, 3);
  assert.equal(state.pulseUntilMs, 2600);

  const active = getUpgradePanelViewModel({
    panelState: state,
    localTank: { state: "alive", upgradePoints: 3 },
    nowMs: 1200
  });
  const expired = getUpgradePanelViewModel({
    panelState: state,
    localTank: { state: "alive", upgradePoints: 3 },
    nowMs: 2700
  });

  assert.equal(active.pulse, true);
  assert.equal(expired.pulse, false);
});

test("upgrade view model hides while gameplay controls are suspended", () => {
  const model = getUpgradePanelViewModel({
    panelState: { collapsed: false, lastAvailablePoints: 3, pulseUntilMs: 0 },
    localTank: { state: "alive", upgradePoints: 3 },
    visible: false
  });

  assert.equal(model.status, "hidden");
  assert.equal(model.visible, false);
  assert.equal(model.canUpgrade, false);
});

test("upgrade hotkey ignores text inputs", () => {
  assert.equal(shouldHandleUpgradePanelHotkey({ code: "KeyU", target: { tagName: "BODY" } }), true);
  assert.equal(shouldHandleUpgradePanelHotkey({ code: "KeyU", target: { tagName: "INPUT" } }), false);
  assert.equal(shouldHandleUpgradePanelHotkey({ code: "KeyT", target: { tagName: "BODY" } }), false);
});

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}
