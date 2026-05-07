import test from "node:test";
import assert from "node:assert/strict";
import {
  createOnboardingState,
  dismissOnboarding,
  getOnboardingPrompt,
  loadOnboardingState,
  markOnboardingTreeOpened,
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_VERSION,
  updateOnboardingFromDeath,
  updateOnboardingFromSnapshot
} from "../client/src/game/onboarding.js";

const NO_GAP = { minPromptGapMs: 0 };

test("onboarding starts with controls prompt while playing", () => {
  const onboarding = createOnboardingState();
  const prompt = getOnboardingPrompt(onboarding, "playing", 1000, NO_GAP);

  assert.equal(prompt.id, "controls");
  assert.equal(getOnboardingPrompt(onboarding, "menu", 1000, NO_GAP), null);
});

test("snapshot milestones advance through firing and XP without completing early", () => {
  const onboarding = createOnboardingState();
  const first = createSnapshot({ vx: 0, projectiles: [], score: 0, upgradePoints: 0, upgrades: {} });
  const second = createSnapshot({
    vx: 100,
    projectiles: [{ id: "bullet-1", ownerId: "player-1" }],
    score: 8,
    upgradePoints: 0,
    upgrades: {}
  });

  updateOnboardingFromSnapshot(onboarding, null, first, "player-1");
  updateOnboardingFromSnapshot(onboarding, first, second, "player-1");

  assert.equal(onboarding.milestones.joined, true);
  assert.equal(onboarding.milestones.moved, true);
  assert.equal(onboarding.milestones.fired, true);
  assert.equal(onboarding.milestones.gainedXp, true);
  assert.equal(onboarding.completed, false);
  assert.equal(getOnboardingPrompt(onboarding, "playing", 3000, NO_GAP), null);
});

test("upgrade point prompt appears and spent upgrade waits for class guidance", () => {
  const onboarding = createReadyOnboarding();
  const ready = createSnapshot({ vx: 10, projectiles: [], score: 120, upgradePoints: 1, upgrades: {} });
  const spent = createSnapshot({
    vx: 10,
    projectiles: [],
    score: 120,
    upgradePoints: 0,
    upgrades: { bulletDamage: 1 }
  });

  updateOnboardingFromSnapshot(onboarding, null, ready, "player-1");
  assert.equal(getOnboardingPrompt(onboarding, "playing", 1000, NO_GAP).id, "upgrade");

  updateOnboardingFromSnapshot(onboarding, ready, spent, "player-1");
  assert.equal(onboarding.milestones.spentUpgrade, true);
  assert.equal(onboarding.completed, false);
  assert.equal(getOnboardingPrompt(onboarding, "playing", 3000, NO_GAP), null);
});

test("class choices trigger class prompt and tree milestone unlocks alpha guidance", () => {
  const onboarding = createReadyOnboarding();
  onboarding.milestones.spentUpgrade = true;
  const classChoice = createSnapshot({
    vx: 10,
    projectiles: [],
    score: 5000,
    upgradePoints: 0,
    upgrades: { bulletDamage: 1 },
    level: 15,
    classUnlockChoices: ["twin", "sniper"],
    centerObjective: { state: "alive", hp: 1000, maxHp: 1400 }
  });
  const selected = createSnapshot({
    vx: 10,
    projectiles: [],
    score: 5000,
    upgradePoints: 0,
    upgrades: { bulletDamage: 1 },
    level: 15,
    classId: "twin",
    classHistory: ["basic", "twin"],
    centerObjective: { state: "alive", hp: 1000, maxHp: 1400 }
  });

  updateOnboardingFromSnapshot(onboarding, null, classChoice, "player-1");
  assert.equal(getOnboardingPrompt(onboarding, "playing", 1000, NO_GAP).id, "classChoice");

  updateOnboardingFromSnapshot(onboarding, classChoice, selected, "player-1");
  assert.equal(getOnboardingPrompt(onboarding, "playing", 2000, NO_GAP).id, "tree");

  markOnboardingTreeOpened(onboarding);
  assert.equal(getOnboardingPrompt(onboarding, "playing", 3000, NO_GAP).id, "alpha");
  assert.equal(onboarding.milestones.alphaSeen, true);
});

test("death message shows death penalty prompt before normal prompts resume", () => {
  const onboarding = createReadyOnboarding();
  updateOnboardingFromDeath(onboarding, { oldLevel: 30, newLevel: 15 });

  const deathPrompt = getOnboardingPrompt(onboarding, "dead", 1000, {
    minPromptGapMs: 0,
    death: { oldLevel: 30, newLevel: 15 }
  });
  assert.equal(deathPrompt.id, "deathPenalty");
  assert.equal(onboarding.milestones.deathPenaltySeen, false);

  assert.equal(
    getOnboardingPrompt(onboarding, "dead", 7000, {
      minPromptGapMs: 0,
      death: { oldLevel: 30, newLevel: 15 }
    }),
    null
  );
  assert.equal(onboarding.milestones.deathPenaltySeen, true);

  assert.equal(getOnboardingPrompt(onboarding, "playing", 8000, NO_GAP).id, "survive");
  assert.equal(onboarding.completed, false);
  assert.equal(getOnboardingPrompt(onboarding, "playing", 14000, NO_GAP), null);
  assert.equal(onboarding.completed, true);
});

test("onboarding hides normal prompts behind modal and class cards", () => {
  const onboarding = createReadyOnboarding();
  assert.equal(getOnboardingPrompt(onboarding, "playing", 1000, { ...NO_GAP, modalOpen: true }), null);
  assert.equal(getOnboardingPrompt(onboarding, "playing", 1000, { ...NO_GAP, classCardsVisible: true }), null);

  onboarding.milestones.spentUpgrade = true;
  onboarding.milestones.classChoiceAvailable = true;
  assert.equal(
    getOnboardingPrompt(onboarding, "playing", 2000, { ...NO_GAP, classCardsVisible: true }).id,
    "classChoice"
  );
});

test("onboarding persistence versions old data and dismisses safely", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value)
  };
  const onboarding = createOnboardingState();

  dismissOnboarding(onboarding, storage);
  assert.equal(onboarding.completed, true);
  assert.equal(onboarding.dismissed, true);

  const loaded = loadOnboardingState(storage);
  assert.equal(loaded.version, ONBOARDING_VERSION);
  assert.equal(loaded.completed, true);
  assert.equal(loaded.dismissed, true);
  assert.ok(memory.has(ONBOARDING_STORAGE_KEY));

  memory.set(ONBOARDING_STORAGE_KEY, JSON.stringify({ completed: true, dismissed: false }));
  const oldCompleted = loadOnboardingState(storage);
  assert.equal(oldCompleted.completed, false);
  assert.equal(oldCompleted.dismissed, false);
});

function createReadyOnboarding() {
  const onboarding = createOnboardingState();
  onboarding.milestones.joined = true;
  onboarding.milestones.moved = true;
  onboarding.milestones.fired = true;
  onboarding.milestones.gainedXp = true;
  return onboarding;
}

function createSnapshot({
  vx,
  projectiles,
  score,
  upgradePoints,
  upgrades,
  level = score > 100 ? 2 : 1,
  classId = "basic",
  classHistory = ["basic"],
  classUnlockChoices = [],
  centerObjective = null
}) {
  return {
    tanks: [
      {
        id: "player-1",
        x: 100,
        y: 100,
        vx,
        vy: 0,
        score,
        level,
        upgradePoints,
        upgrades,
        state: "alive",
        classId,
        classHistory,
        classUnlockChoices
      }
    ],
    projectiles,
    shapes: [],
    centerObjective
  };
}
