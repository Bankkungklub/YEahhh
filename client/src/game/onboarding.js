export const ONBOARDING_STORAGE_KEY = "tankArena.onboarding.v1";
export const ONBOARDING_VERSION = 2;
const FINAL_PROMPT_READ_MS = 5200;

export const ONBOARDING_PROMPTS = Object.freeze({
  controls: {
    id: "controls",
    text: "Move with WASD and aim with mouse. On touch, left thumb moves and right thumb aims/fires."
  },
  farm: {
    id: "farm",
    text: "Shoot shapes for XP. Yellow squares are easy; bigger shapes pay more."
  },
  upgrade: {
    id: "upgrade",
    text: "Spend stat points with the upgrades panel. Damage and reload make farming faster."
  },
  classChoice: {
    id: "classChoice",
    text: "Class upgrade ready. Pick a card or press 1-4; each branch changes how your tank fights."
  },
  tree: {
    id: "tree",
    text: "Press T to open the full tank tree and preview level 15, 30, 45, and 60 forms."
  },
  alpha: {
    id: "alpha",
    text: "The center Alpha Pentagon gives huge shared XP. Contest it when you can survive the fight."
  },
  deathPenalty: {
    id: "deathPenalty",
    text: "Death cuts your level and score in half. Respawn, re-spend points, and rebuild safely."
  },
  survive: {
    id: "survive",
    text: "Stay alive, farm smart, and use the minimap to choose safer fights."
  }
});

export function createOnboardingState({
  completed = false,
  dismissed = false,
  version = ONBOARDING_VERSION
} = {}) {
  return {
    version,
    completed: Boolean(completed),
    dismissed: Boolean(dismissed),
    visiblePromptId: null,
    lastPromptChangedAtMs: 0,
    milestones: {
      joined: false,
      moved: false,
      fired: false,
      gainedXp: false,
      hasUpgradePoint: false,
      spentUpgrade: false,
      classChoiceAvailable: false,
      selectedFirstClass: false,
      alphaAvailable: false,
      alphaSeen: false,
      openedTree: false,
      diedOnce: false,
      deathPenaltySeen: false,
      surviveSeen: false
    }
  };
}

export function loadOnboardingState(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(ONBOARDING_STORAGE_KEY);
    if (!raw) {
      return createOnboardingState();
    }

    const parsed = JSON.parse(raw);
    const storedVersion = Number(parsed?.version) || 1;
    const dismissed = Boolean(parsed?.dismissed);
    const completed = storedVersion >= ONBOARDING_VERSION ? Boolean(parsed?.completed) : dismissed;
    return createOnboardingState({
      version: ONBOARDING_VERSION,
      completed,
      dismissed
    });
  } catch {
    return createOnboardingState();
  }
}

export function persistOnboardingState(onboarding, storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({
        version: ONBOARDING_VERSION,
        completed: Boolean(onboarding.completed),
        dismissed: Boolean(onboarding.dismissed)
      })
    );
  } catch {
    // Onboarding must never break gameplay if browser storage is unavailable.
  }
}

export function dismissOnboarding(onboarding, storage = globalThis.localStorage) {
  if (!onboarding) {
    return;
  }
  onboarding.version = ONBOARDING_VERSION;
  onboarding.dismissed = true;
  onboarding.completed = true;
  onboarding.visiblePromptId = null;
  persistOnboardingState(onboarding, storage);
}

export function updateOnboardingFromSnapshot(onboarding, previousSnapshot, snapshot, playerId) {
  if (!onboarding || onboarding.completed || onboarding.dismissed || !snapshot || !playerId) {
    return onboarding;
  }

  const localTank = snapshot.tanks.find((tank) => tank.id === playerId) ?? null;
  const previousTank = previousSnapshot?.tanks?.find((tank) => tank.id === playerId) ?? null;
  if (!localTank) {
    return onboarding;
  }

  onboarding.milestones.joined = true;
  onboarding.milestones.moved = onboarding.milestones.moved ||
    Math.hypot(localTank.vx || 0, localTank.vy || 0) > 1 ||
    Boolean(previousTank && Math.hypot(localTank.x - previousTank.x, localTank.y - previousTank.y) > 1);
  onboarding.milestones.fired = onboarding.milestones.fired ||
    (snapshot.projectiles ?? []).some((projectile) => projectile.ownerId === playerId);
  onboarding.milestones.gainedXp = onboarding.milestones.gainedXp ||
    localTank.score > 0 ||
    localTank.level > 1;
  onboarding.milestones.hasUpgradePoint = onboarding.milestones.hasUpgradePoint ||
    localTank.upgradePoints > 0;
  onboarding.milestones.spentUpgrade = onboarding.milestones.spentUpgrade ||
    getUpgradeTotal(localTank.upgrades) > 0;
  onboarding.milestones.classChoiceAvailable = onboarding.milestones.classChoiceAvailable ||
    (Array.isArray(localTank.classUnlockChoices) && localTank.classUnlockChoices.length > 0);
  onboarding.milestones.selectedFirstClass = onboarding.milestones.selectedFirstClass ||
    Boolean(localTank.classId && localTank.classId !== "basic") ||
    (Array.isArray(localTank.classHistory) && localTank.classHistory.length > 1);
  onboarding.milestones.alphaAvailable = onboarding.milestones.alphaAvailable ||
    Boolean(snapshot.centerObjective) ||
    (snapshot.shapes ?? []).some((shape) => shape.type === "alphaPentagon");

  return onboarding;
}

export function updateOnboardingFromDeath(onboarding, deathMessage) {
  if (!onboarding || onboarding.completed || onboarding.dismissed || !deathMessage) {
    return onboarding;
  }
  onboarding.milestones.diedOnce = true;
  return onboarding;
}

export function markOnboardingTreeOpened(onboarding) {
  if (!onboarding || onboarding.completed || onboarding.dismissed) {
    return onboarding;
  }
  onboarding.milestones.openedTree = true;
  return onboarding;
}

export function getOnboardingPrompt(
  onboarding,
  screen,
  nowMs,
  {
    minPromptGapMs = 1200,
    modalOpen = false,
    classCardsVisible = false,
    death = null
  } = {}
) {
  if (!onboarding || onboarding.completed || onboarding.dismissed || modalOpen) {
    return null;
  }

  if (screen === "dead") {
    if (onboarding.visiblePromptId === "deathPenalty") {
      if (nowMs - onboarding.lastPromptChangedAtMs >= FINAL_PROMPT_READ_MS) {
        onboarding.milestones.deathPenaltySeen = true;
        onboarding.visiblePromptId = null;
        return null;
      }
      return ONBOARDING_PROMPTS.deathPenalty;
    }
    if (onboarding.milestones.diedOnce && death && !onboarding.milestones.deathPenaltySeen) {
      return markPromptVisible(onboarding, ONBOARDING_PROMPTS.deathPenalty, nowMs, minPromptGapMs);
    }
    return null;
  }

  if (screen !== "playing") {
    return null;
  }

  if (onboarding.visiblePromptId === "survive" && onboarding.milestones.surviveSeen) {
    if (nowMs - onboarding.lastPromptChangedAtMs >= FINAL_PROMPT_READ_MS) {
      onboarding.completed = true;
      onboarding.visiblePromptId = null;
      return null;
    }
    return ONBOARDING_PROMPTS.survive;
  }

  const nextPrompt = choosePrompt(onboarding.milestones);
  if (!nextPrompt) {
    onboarding.visiblePromptId = null;
    return null;
  }

  if (classCardsVisible && nextPrompt.id !== "classChoice") {
    return null;
  }

  return markPromptVisible(onboarding, nextPrompt, nowMs, minPromptGapMs);
}

function choosePrompt(milestones) {
  if (!milestones.joined || !milestones.moved || !milestones.fired) {
    return ONBOARDING_PROMPTS.controls;
  }
  if (!milestones.gainedXp) {
    return ONBOARDING_PROMPTS.farm;
  }
  if (milestones.hasUpgradePoint && !milestones.spentUpgrade) {
    return ONBOARDING_PROMPTS.upgrade;
  }
  if (milestones.classChoiceAvailable && !milestones.selectedFirstClass) {
    return ONBOARDING_PROMPTS.classChoice;
  }
  if (milestones.selectedFirstClass && !milestones.openedTree) {
    return ONBOARDING_PROMPTS.tree;
  }
  if (milestones.alphaAvailable && (milestones.selectedFirstClass || milestones.openedTree) && !milestones.alphaSeen) {
    return ONBOARDING_PROMPTS.alpha;
  }
  if ((milestones.alphaSeen || milestones.deathPenaltySeen) && !milestones.surviveSeen) {
    return ONBOARDING_PROMPTS.survive;
  }
  return null;
}

function markPromptVisible(onboarding, prompt, nowMs, minPromptGapMs) {
  if (
    onboarding.visiblePromptId &&
    onboarding.visiblePromptId !== prompt.id &&
    nowMs - onboarding.lastPromptChangedAtMs < minPromptGapMs
  ) {
    return ONBOARDING_PROMPTS[onboarding.visiblePromptId] ?? prompt;
  }

  if (onboarding.visiblePromptId !== prompt.id) {
    onboarding.visiblePromptId = prompt.id;
    onboarding.lastPromptChangedAtMs = nowMs;
  }
  markPromptMilestone(onboarding, prompt.id);
  return prompt;
}

function markPromptMilestone(onboarding, promptId) {
  if (promptId === "alpha") {
    onboarding.milestones.alphaSeen = true;
  } else if (promptId === "survive") {
    onboarding.milestones.surviveSeen = true;
  }
}

function getUpgradeTotal(upgrades = {}) {
  return Object.values(upgrades).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
}
