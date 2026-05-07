import test from "node:test";
import assert from "node:assert/strict";
import { getHudVisibility, isGameplayPanelInteractive } from "../client/src/ui/hudVisibility.js";

test("alive gameplay shows upgrade controls and class cards", () => {
  const visibility = getHudVisibility({
    state: { screen: "playing", account: { isDeveloper: true } },
    localTank: { state: "alive" }
  });

  assert.equal(visibility.showStatUpgrades, true);
  assert.equal(visibility.showClassCards, true);
  assert.equal(visibility.showTreeButton, true);
  assert.equal(visibility.showDeveloperPanel, true);
  assert.equal(visibility.showLeaderboard, true);
  assert.equal(isGameplayPanelInteractive(visibility), true);
});

test("compact mobile gameplay hides full leaderboard without blocking core controls", () => {
  const visibility = getHudVisibility({
    state: { screen: "playing", account: { isDeveloper: false } },
    localTank: { state: "alive" },
    viewportProfile: { compactHud: true, phonePortrait: true }
  });

  assert.equal(visibility.compactHud, true);
  assert.equal(visibility.showLeaderboard, false);
  assert.equal(visibility.showStatUpgrades, true);
  assert.equal(visibility.showClassCards, true);
  assert.equal(visibility.showTreeButton, true);
});

test("dead gameplay hides interactive upgrade and developer controls", () => {
  const visibility = getHudVisibility({
    state: { screen: "dead", account: { isDeveloper: true }, death: { killerName: "Bot" } },
    localTank: { state: "dead", classUnlockChoices: ["twin"] }
  });

  assert.equal(visibility.showDeathOverlay, true);
  assert.equal(visibility.showStatUpgrades, false);
  assert.equal(visibility.showClassCards, false);
  assert.equal(visibility.showTreeButton, false);
  assert.equal(visibility.showDeveloperPanel, false);
  assert.equal(isGameplayPanelInteractive(visibility), false);
});

test("open modal suspends class cards without hiding stat upgrades", () => {
  const visibility = getHudVisibility({
    state: { screen: "playing", account: { isDeveloper: false } },
    localTank: { state: "alive", classUnlockChoices: ["twin"] },
    modalOpen: true
  });

  assert.equal(visibility.showStatUpgrades, true);
  assert.equal(visibility.showClassCards, false);
  assert.equal(visibility.classCardsSuspended, true);
  assert.equal(visibility.showTreeButton, true);
});
