import test from "node:test";
import assert from "node:assert/strict";
import { getHudActionPriority, HUD_ACTION_IDS } from "../client/src/ui/hudActionPriority.js";

const visibleGameplay = {
  showClassCards: true,
  showStatUpgrades: true,
  showDeathOverlay: false,
  modalOpen: false
};

test("HUD action priority chooses death over all gameplay actions", () => {
  const action = getHudActionPriority({
    state: {
      screen: "dead",
      death: { oldLevel: 30, newLevel: 15 },
      classUpgradeUi: { status: "visible", tierLevel: 45 }
    },
    localTank: { state: "dead", upgradePoints: 7 },
    visibility: { ...visibleGameplay, showDeathOverlay: true }
  });

  assert.equal(action.id, HUD_ACTION_IDS.DEATH);
  assert.equal(action.detail, "LV 30 -> 15");
});

test("HUD action priority chooses class cards before stat upgrades", () => {
  const action = getHudActionPriority({
    state: {
      screen: "playing",
      classUpgradeUi: { status: "visible", tierLevel: 15 }
    },
    localTank: { state: "alive", upgradePoints: 6 },
    visibility: visibleGameplay
  });

  assert.equal(action.id, HUD_ACTION_IDS.CLASS_CHOICE);
  assert.equal(action.label, "CHOOSE CLASS");
});

test("HUD action priority chooses stat upgrades before Alpha state", () => {
  const action = getHudActionPriority({
    state: {
      screen: "playing",
      classUpgradeUi: { status: "hidden" },
      latestSnapshot: {
        centerObjective: {
          enabled: true,
          state: "alive",
          hp: 200,
          maxHp: 1400,
          xp: 4200
        }
      }
    },
    localTank: { state: "alive", hp: 100, maxHp: 100, level: 20, upgradePoints: 2 },
    visibility: visibleGameplay
  });

  assert.equal(action.id, HUD_ACTION_IDS.STAT_UPGRADE);
});

test("HUD action priority chooses critical Alpha before damage and farm", () => {
  const action = getHudActionPriority({
    state: {
      screen: "playing",
      classUpgradeUi: { status: "hidden" },
      effects: [{ type: "damageCauseToast", text: "Rocket", startMs: 1000, ttlMs: 650 }],
      latestSnapshot: {
        centerObjective: {
          enabled: true,
          state: "alive",
          hp: 420,
          maxHp: 1400,
          xp: 4200
        }
      }
    },
    localTank: { state: "alive", hp: 100, maxHp: 100, level: 20, upgradePoints: 0 },
    visibility: visibleGameplay,
    now: 1100
  });

  assert.equal(action.id, HUD_ACTION_IDS.ALPHA_CRITICAL);
  assert.match(action.label, /ALPHA LOW/);
});

test("HUD action priority shows nearby bounty after urgent combat actions", () => {
  const state = {
    screen: "playing",
    classUpgradeUi: { status: "hidden" },
    latestSnapshot: {
      rivals: [
        {
          id: "bot-bounty",
          tier: "bounty",
          name: "Duelist Byte-01",
          x: 1300,
          y: 1000,
          hpRatio: 0.8,
          bountyCoins: 12
        }
      ]
    }
  };
  const localTank = { id: "player-1", state: "alive", x: 1000, y: 1000, hp: 100, maxHp: 100, level: 12, upgradePoints: 0 };
  const action = getHudActionPriority({
    state,
    localTank,
    visibility: visibleGameplay
  });

  assert.equal(action.id, HUD_ACTION_IDS.RIVAL);
  assert.equal(action.label, "BOUNTY NEAR");
  assert.match(action.detail, /\+12C/);

  const dangerAction = getHudActionPriority({
    state: {
      ...state,
      effects: [{ type: "damageCauseToast", text: "Bullet", startMs: 1000, ttlMs: 650 }]
    },
    localTank,
    visibility: visibleGameplay,
    now: 1100
  });
  assert.equal(dangerAction.id, HUD_ACTION_IDS.UNDER_ATTACK);
});

test("HUD action priority labels revenge and low bounty rival states", () => {
  const localTank = { id: "player-1", state: "alive", x: 1000, y: 1000, hp: 100, maxHp: 100, level: 12, upgradePoints: 0 };
  const revenge = getHudActionPriority({
    state: {
      screen: "playing",
      latestSnapshot: {
        rivals: [{ id: "bot", tier: "rival", x: 1000, y: 1100, targetId: "player-1", bountyCoins: 0 }]
      }
    },
    localTank,
    visibility: visibleGameplay
  });
  const low = getHudActionPriority({
    state: {
      screen: "playing",
      latestSnapshot: {
        rivals: [{ id: "bot", tier: "bounty", x: 1000, y: 1100, hpRatio: 0.2, bountyCoins: 8 }]
      }
    },
    localTank,
    visibility: visibleGameplay
  });

  assert.equal(revenge.label, "REVENGE TARGET");
  assert.equal(low.label, "RIVAL LOW");
});

test("HUD action priority hides behind onboarding and modal", () => {
  const onboardingAction = getHudActionPriority({
    state: { screen: "playing" },
    localTank: { state: "alive", upgradePoints: 3 },
    visibility: visibleGameplay,
    onboardingPrompt: { id: "upgrade" }
  });
  const modalAction = getHudActionPriority({
    state: { screen: "playing" },
    localTank: { state: "alive", upgradePoints: 3 },
    visibility: { ...visibleGameplay, modalOpen: true }
  });

  assert.equal(onboardingAction.visible, false);
  assert.equal(modalAction.visible, false);
});

test("HUD action priority falls back to objective or farm", () => {
  const objectiveAction = getHudActionPriority({
    state: {
      screen: "playing",
      latestSnapshot: {
        centerObjective: {
          enabled: true,
          state: "alive",
          hp: 900,
          maxHp: 1400
        }
      }
    },
    localTank: { state: "alive", hp: 80, maxHp: 100, level: 12, upgradePoints: 0 },
    visibility: visibleGameplay
  });
  const farmAction = getHudActionPriority({
    state: { screen: "playing" },
    localTank: { state: "alive", hp: 40, maxHp: 100, level: 3, upgradePoints: 0 },
    visibility: visibleGameplay
  });

  assert.equal(objectiveAction.id, HUD_ACTION_IDS.OBJECTIVE);
  assert.equal(farmAction.id, HUD_ACTION_IDS.FARM);
});

test("HUD action priority shows nearest sector event above default farm", () => {
  const action = getHudActionPriority({
    state: {
      screen: "playing",
      latestSnapshot: {
        centerObjective: {
          enabled: true,
          state: "alive",
          hp: 1000,
          maxHp: 1400
        },
        eventObjectives: [
          {
            id: "far",
            state: "alive",
            shortLabel: "BEACON",
            x: 2500,
            y: 1000,
            hpRatio: 0.75,
            expiresInMs: 40000,
            threatLevel: 2
          },
          {
            id: "near",
            state: "alive",
            shortLabel: "VOLATILE",
            x: 1200,
            y: 1000,
            hpRatio: 0.2,
            expiresInMs: 18000,
            threatLevel: 3
          }
        ]
      }
    },
    localTank: { state: "alive", x: 1000, y: 1000, hp: 40, maxHp: 100, level: 6, upgradePoints: 0 },
    visibility: visibleGameplay
  });

  assert.equal(action.id, HUD_ACTION_IDS.EVENT_OBJECTIVE);
  assert.equal(action.label, "VOLATILE 20%");
  assert.equal(action.tone, "danger");
});
