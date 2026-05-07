export const HUD_ACTION_IDS = Object.freeze({
  HIDDEN: "hidden",
  DEATH: "death",
  CLASS_CHOICE: "classChoice",
  STAT_UPGRADE: "statUpgrade",
  ALPHA_CRITICAL: "alphaCritical",
  UNDER_ATTACK: "underAttack",
  RIVAL: "rival",
  EVENT_OBJECTIVE: "eventObjective",
  OBJECTIVE: "objective",
  FARM: "farm"
});

const DEFAULT_CONFIG = Object.freeze({
  alphaCriticalHpRatio: 0.35,
  alphaRespawnSoonMs: 15000,
  objectiveMinLevel: 8,
  objectiveMinHpRatio: 0.5,
  damageEffectWindowMs: 900,
  rivalAlertRange: 1400,
  rivalLowHpRatio: 0.35
});

export function getHudActionPriority({
  state = {},
  localTank = null,
  visibility = {},
  now = 0,
  onboardingPrompt = null,
  config = DEFAULT_CONFIG
} = {}) {
  const hidden = createAction(HUD_ACTION_IDS.HIDDEN, { visible: false });
  const screen = state.screen ?? "menu";
  const death = state.death ?? null;
  const tankDead = localTank?.state === "dead";

  if (visibility.showDeathOverlay || screen === "dead" || tankDead) {
    return createAction(HUD_ACTION_IDS.DEATH, {
      label: death?.respawnAtMs ? "RESPAWN SOON" : "RESPAWN",
      detail: getDeathDetail(death),
      tone: "danger",
      target: "death",
      urgency: 100
    });
  }

  if (screen !== "playing" || visibility.modalOpen || onboardingPrompt) {
    return hidden;
  }

  const classUi = state.classUpgradeUi ?? {};
  if (visibility.showClassCards && (classUi.status === "visible" || classUi.visible)) {
    return createAction(HUD_ACTION_IDS.CLASS_CHOICE, {
      label: "CHOOSE CLASS",
      detail: classUi.tierLevel ? `LEVEL ${classUi.tierLevel}` : "",
      tone: "gold",
      target: "classCards",
      urgency: 90
    });
  }

  const upgradePoints = Math.max(0, Math.trunc(Number(localTank?.upgradePoints) || 0));
  if (visibility.showStatUpgrades && upgradePoints > 0) {
    return createAction(HUD_ACTION_IDS.STAT_UPGRADE, {
      label: `SPEND +${upgradePoints}`,
      detail: "UPGRADES",
      tone: "good",
      target: "statUpgrades",
      urgency: 80
    });
  }

  const objective = state.latestSnapshot?.centerObjective;
  const alphaCritical = getAlphaCriticalAction(objective, config);
  if (alphaCritical) {
    return alphaCritical;
  }

  const danger = getUnderAttackAction(state.effects, now, config);
  if (danger) {
    return danger;
  }

  const rivalAction = getRivalAction(state.latestSnapshot?.rivals, localTank, config);
  if (rivalAction) {
    return rivalAction;
  }

  const eventAction = getEventObjectiveAction(state.latestSnapshot?.eventObjectives, localTank);
  if (eventAction) {
    return eventAction;
  }

  if (isStableEnoughForObjective(localTank, objective, config)) {
    const percent = Math.max(0, Math.round((objective.hp / Math.max(1, objective.maxHp)) * 100));
    return createAction(HUD_ACTION_IDS.OBJECTIVE, {
      label: "CONTEST ALPHA",
      detail: `${percent}% HP`,
      tone: "objective",
      target: "alpha",
      urgency: 40
    });
  }

  if (localTank?.state === "alive") {
    return createAction(HUD_ACTION_IDS.FARM, {
      label: "FARM SHAPES",
      detail: "LEVEL UP",
      tone: "muted",
      target: "world",
      urgency: 10
    });
  }

  return hidden;
}

function getRivalAction(rivals = [], localTank = null, config) {
  if (!localTank || localTank.state !== "alive" || !Array.isArray(rivals) || rivals.length === 0) {
    return null;
  }
  const alertRange = Math.max(0, Number(config.rivalAlertRange) || 0);
  const lowHpRatio = Math.max(0, Math.min(1, Number(config.rivalLowHpRatio) || 0));
  const nearest = rivals
    .filter((rival) => rival && (rival.tier === "bounty" || rival.targetId === localTank.id || rival.revengeTargetId === localTank.id))
    .map((rival) => ({
      rival,
      distance: Math.hypot((rival.x ?? 0) - localTank.x, (rival.y ?? 0) - localTank.y)
    }))
    .filter((entry) => entry.distance <= alertRange)
    .sort((a, b) => getRivalPriority(b.rival, localTank, lowHpRatio) - getRivalPriority(a.rival, localTank, lowHpRatio) || a.distance - b.distance)[0];
  if (!nearest) {
    return null;
  }

  const { rival, distance } = nearest;
  const coins = Math.max(0, Math.trunc(Number(rival.bountyCoins) || 0));
  const detail = coins > 0
    ? `${Math.round(distance)}m | +${coins}C`
    : `${Math.round(distance)}m`;
  if (rival.revengeTargetId === localTank.id || rival.targetId === localTank.id) {
    return createAction(HUD_ACTION_IDS.RIVAL, {
      label: "REVENGE TARGET",
      detail,
      tone: "danger",
      target: "rival",
      urgency: 55
    });
  }
  if (rival.tier === "bounty" && (Number(rival.hpRatio) || 0) <= lowHpRatio) {
    return createAction(HUD_ACTION_IDS.RIVAL, {
      label: "RIVAL LOW",
      detail,
      tone: "gold",
      target: "rival",
      urgency: 52
    });
  }
  return createAction(HUD_ACTION_IDS.RIVAL, {
    label: "BOUNTY NEAR",
    detail,
    tone: "gold",
    target: "rival",
    urgency: 50
  });
}

function getRivalPriority(rival, localTank, lowHpRatio) {
  if (rival?.revengeTargetId === localTank.id || rival?.targetId === localTank.id) {
    return 3;
  }
  if (rival?.tier === "bounty" && (Number(rival.hpRatio) || 0) <= lowHpRatio) {
    return 2;
  }
  return rival?.tier === "bounty" ? 1 : 0;
}

function getEventObjectiveAction(events = [], localTank = null) {
  if (!localTank || localTank.state !== "alive" || !Array.isArray(events) || events.length === 0) {
    return null;
  }
  const nearest = events
    .filter((event) => event?.state === "alive")
    .map((event) => ({
      event,
      distance: Math.hypot((event.x ?? 0) - localTank.x, (event.y ?? 0) - localTank.y)
    }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!nearest) {
    return null;
  }
  const hpPercent = Math.max(0, Math.round((nearest.event.hpRatio ?? 0) * 100));
  const seconds = Math.max(0, Math.ceil((nearest.event.expiresInMs ?? 0) / 1000));
  return createAction(HUD_ACTION_IDS.EVENT_OBJECTIVE, {
    label: `${nearest.event.shortLabel ?? "EVENT"} ${hpPercent}%`,
    detail: `${Math.round(nearest.distance)}m | ${seconds}s`,
    tone: nearest.event.threatLevel >= 3 ? "danger" : "objective",
    target: "eventObjective",
    urgency: 45 + Math.min(10, nearest.event.threatLevel ?? 0)
  });
}

function getAlphaCriticalAction(objective, config) {
  if (!objective?.enabled) {
    return null;
  }
  if (objective.state === "alive") {
    const hpRatio = (Number(objective.hp) || 0) / Math.max(1, Number(objective.maxHp) || 1);
    if (hpRatio <= config.alphaCriticalHpRatio) {
      return createAction(HUD_ACTION_IDS.ALPHA_CRITICAL, {
        label: `ALPHA LOW ${Math.max(0, Math.round(hpRatio * 100))}%`,
        detail: `+${objective.xp ?? 0} XP`,
        tone: "danger",
        target: "alpha",
        urgency: 70
      });
    }
  }
  if (objective.state === "down") {
    const respawnInMs = Math.max(0, Number(objective.respawnInMs) || 0);
    if (respawnInMs > 0 && respawnInMs <= config.alphaRespawnSoonMs) {
      return createAction(HUD_ACTION_IDS.ALPHA_CRITICAL, {
        label: `ALPHA ${Math.ceil(respawnInMs / 1000)}s`,
        detail: "RESPAWNING",
        tone: "gold",
        target: "alpha",
        urgency: 70
      });
    }
  }
  return null;
}

function getUnderAttackAction(effects = [], now, config) {
  const recent = [...effects]
    .reverse()
    .find((effect) => (
      (effect.type === "damageCauseToast" || effect.type === "damageDirection") &&
      now - (effect.startMs ?? 0) <= Math.min(effect.ttlMs ?? config.damageEffectWindowMs, config.damageEffectWindowMs)
    ));
  if (!recent) {
    return null;
  }
  return createAction(HUD_ACTION_IDS.UNDER_ATTACK, {
    label: "DANGER",
    detail: recent.text ?? "UNDER FIRE",
    tone: "danger",
    target: "combat",
    urgency: 60
  });
}

function isStableEnoughForObjective(localTank, objective, config) {
  if (!localTank || localTank.state !== "alive" || objective?.state !== "alive") {
    return false;
  }
  const hpRatio = (Number(localTank.hp) || 0) / Math.max(1, Number(localTank.maxHp) || 1);
  return hpRatio >= config.objectiveMinHpRatio && (localTank.level ?? 1) >= config.objectiveMinLevel;
}

function getDeathDetail(death) {
  if (!death) {
    return "DESTROYED";
  }
  if (Number.isFinite(death.oldLevel) && Number.isFinite(death.newLevel) && death.oldLevel !== death.newLevel) {
    return `LV ${death.oldLevel} -> ${death.newLevel}`;
  }
  return "DESTROYED";
}

function createAction(id, {
  label = "",
  detail = "",
  tone = "muted",
  target = "",
  urgency = 0,
  visible = true
} = {}) {
  return {
    id,
    label,
    detail,
    tone,
    target,
    urgency,
    visible
  };
}
