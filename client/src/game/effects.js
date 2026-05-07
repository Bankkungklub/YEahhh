import { appendCombatEffects } from "./combatEffects.js";
import { COMBAT_FEEDBACK_CONFIG } from "../../../shared/config/combatFeedbackConfig.js";
import { formatDamageCause } from "../../../shared/sim/damageSources.js";

export const FEEDBACK_CONFIG = Object.freeze({
  damageTextTtlMs: 650,
  xpTextTtlMs: 900,
  levelPulseTtlMs: 1200,
  hitFlashTtlMs: 180,
  screenShakeTtlMs: 140,
  screenShakeMaxPx: 3,
  upgradePulseTtlMs: 1400,
  effectCap: 80
});

export function deriveEffects(previous, next, playerId, nowMs, firstEffectId = 1) {
  const effects = [];
  let nextEffectId = firstEffectId;
  const localUpdates = {
    levelPulseUntilMs: 0,
    upgradePulseUntilMs: 0,
    lastLocalXp: 0,
    lastLocalLevel: 1,
    lastLocalUpgradePoints: 0
  };

  if (!next || !playerId) {
    return { effects, nextEffectId, localUpdates };
  }

  const nextLocal = next.tanks.find((tank) => tank.id === playerId) ?? null;
  if (nextLocal) {
    localUpdates.lastLocalXp = nextLocal.xp;
    localUpdates.lastLocalLevel = nextLocal.level;
    localUpdates.lastLocalUpgradePoints = nextLocal.upgradePoints;
  }

  if (!previous || !nextLocal) {
    return { effects, nextEffectId, localUpdates };
  }

  const prevTanks = mapById(previous.tanks);
  const prevShapes = mapById(previous.shapes);
  const nextShapes = mapById(next.shapes);
  const prevDrones = mapById(previous.drones ?? []);
  const nextDrones = mapById(next.drones ?? []);
  const prevLocal = prevTanks.get(playerId) ?? null;

  const append = (effect) => {
    effects.push({
      id: `effect-${nextEffectId}`,
      startMs: nowMs,
      ...effect
    });
    nextEffectId += 1;
  };

  appendCombatEffects({ previousSnapshot: previous, nextSnapshot: next, append });

  for (const tank of next.tanks) {
    const prevTank = prevTanks.get(tank.id);
    if (!prevTank || prevTank.state === "dead" || tank.state === "dead") {
      continue;
    }

    const damage = Math.round(prevTank.hp - tank.hp);
    if (damage <= 0) {
      continue;
    }

    appendHitFeedback(append, {
      x: tank.x,
      y: tank.y,
      radius: tank.radius,
      amount: damage,
      targetType: "tank",
      isLocal: tank.id === playerId
    });

    if (tank.id === playerId) {
      append({
        type: "screenShake",
        ttlMs: FEEDBACK_CONFIG.screenShakeTtlMs,
        magnitude: Math.min(FEEDBACK_CONFIG.screenShakeMaxPx, 1.25 + damage * 0.035)
      });
    }
  }

  for (const shape of next.shapes) {
    const prevShape = prevShapes.get(shape.id);
    if (!prevShape) {
      continue;
    }

    const damage = Math.round(prevShape.hp - shape.hp);
    if (damage <= 0) {
      continue;
    }

    appendHitFeedback(append, {
      x: shape.x,
      y: shape.y,
      radius: shape.radius,
      amount: damage,
      targetType: "shape",
      isLocal: false
    });
  }

  for (const prevShape of previous.shapes) {
    if (nextShapes.has(prevShape.id)) {
      continue;
    }

    append({
      type: "hitFlash",
      targetType: "shape",
      ttlMs: FEEDBACK_CONFIG.hitFlashTtlMs * 1.5,
      x: prevShape.x,
      y: prevShape.y,
      radius: prevShape.radius + 6,
      color: "#faae2b"
    });
  }

  for (const drone of next.drones ?? []) {
    const prevDrone = prevDrones.get(drone.id);
    if (!prevDrone) {
      continue;
    }
    const damage = Math.round(prevDrone.hp - drone.hp);
    if (damage <= 0) {
      continue;
    }
    appendHitFeedback(append, {
      x: drone.x,
      y: drone.y,
      radius: drone.radius,
      amount: damage,
      targetType: "drone",
      isLocal: drone.ownerId === playerId
    });
  }

  for (const prevDrone of previous.drones ?? []) {
    if (nextDrones.has(prevDrone.id)) {
      continue;
    }
    append({
      type: "hitFlash",
      targetType: "drone",
      ttlMs: FEEDBACK_CONFIG.hitFlashTtlMs,
      x: prevDrone.x,
      y: prevDrone.y,
      radius: (prevDrone.radius ?? 10) + 8,
      color: "#b8f28e"
    });
  }

  if (prevLocal && nextLocal) {
    const scoreGain = Math.round(nextLocal.score - prevLocal.score);
    if (scoreGain > 0) {
      append({
        type: "xpText",
        ttlMs: FEEDBACK_CONFIG.xpTextTtlMs,
        x: nextLocal.x,
        y: nextLocal.y - nextLocal.radius - 22,
        text: `+${scoreGain} XP`,
        color: "#faae2b"
      });
    }

    if (nextLocal.level > prevLocal.level) {
      localUpdates.levelPulseUntilMs = nowMs + FEEDBACK_CONFIG.levelPulseTtlMs;
      append({
        type: "levelToast",
        ttlMs: FEEDBACK_CONFIG.levelPulseTtlMs,
        text: `LEVEL ${nextLocal.level}`,
        color: "#faae2b"
      });
    }

    if (prevLocal.upgradePoints <= 0 && nextLocal.upgradePoints > 0) {
      localUpdates.upgradePulseUntilMs = nowMs + FEEDBACK_CONFIG.upgradePulseTtlMs;
      append({
        type: "upgradeReady",
        ttlMs: FEEDBACK_CONFIG.upgradePulseTtlMs,
        text: "UPGRADE READY",
        color: "#3da9fc"
      });
    }
  }

  return { effects, nextEffectId, localUpdates };
}

export function deriveDamageEventEffects(damageMessage, localTank, nowMs, firstEffectId = 1) {
  const effects = [];
  let nextEffectId = firstEffectId;
  if (!damageMessage || !localTank) {
    return { effects, nextEffectId };
  }
  const amount = Math.max(0, Number(damageMessage.amount) || 0);
  if (amount <= 0) {
    return { effects, nextEffectId };
  }
  const maxHp = Math.max(1, Number(localTank.maxHp) || 1);
  const intensity = Math.max(0.15, Math.min(1, amount / maxHp));
  const sourceX = Number.isFinite(damageMessage.sourceX) ? damageMessage.sourceX : localTank.x;
  const sourceY = Number.isFinite(damageMessage.sourceY) ? damageMessage.sourceY : localTank.y;
  const targetX = Number.isFinite(damageMessage.targetX) ? damageMessage.targetX : localTank.x;
  const targetY = Number.isFinite(damageMessage.targetY) ? damageMessage.targetY : localTank.y;
  const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
  const color = damageMessage.color ?? COMBAT_FEEDBACK_CONFIG.causes.unknown.color;
  effects.push({
    id: `effect-${nextEffectId}`,
    startMs: nowMs,
    type: "damageDirection",
    ttlMs: COMBAT_FEEDBACK_CONFIG.damageIndicatorTtlMs,
    x: targetX,
    y: targetY,
    angle,
    intensity,
    color,
    cause: damageMessage.cause
  });
  nextEffectId += 1;

  if (intensity >= COMBAT_FEEDBACK_CONFIG.damageToastMinHpRatio) {
    effects.push({
      id: `effect-${nextEffectId}`,
      startMs: nowMs,
      type: "damageCauseToast",
      ttlMs: COMBAT_FEEDBACK_CONFIG.damageToastTtlMs,
      x: targetX,
      y: targetY - (localTank.radius ?? 24) - 30,
      text: formatDamageCause(damageMessage),
      color
    });
    nextEffectId += 1;
  }

  return { effects, nextEffectId };
}

export function pruneEffects(effects, nowMs, cap = FEEDBACK_CONFIG.effectCap) {
  const active = effects.filter((effect) => nowMs - effect.startMs <= effect.ttlMs);
  return active.length > cap ? active.slice(active.length - cap) : active;
}

export function getEffectProgress(effect, nowMs) {
  return Math.max(0, Math.min(1, (nowMs - effect.startMs) / effect.ttlMs));
}

export function getActiveScreenShake(effects, nowMs) {
  let magnitude = 0;

  for (const effect of effects) {
    if (effect.type !== "screenShake") {
      continue;
    }
    const progress = getEffectProgress(effect, nowMs);
    if (progress >= 1) {
      continue;
    }
    magnitude = Math.max(magnitude, effect.magnitude * (1 - progress));
  }

  if (magnitude <= 0) {
    return { x: 0, y: 0, magnitude: 0 };
  }

  return {
    x: Math.sin(nowMs * 0.045) * magnitude,
    y: Math.cos(nowMs * 0.063) * magnitude,
    magnitude
  };
}

function appendHitFeedback(append, { x, y, radius, amount, targetType, isLocal }) {
  append({
    type: "hitFlash",
    targetType,
    ttlMs: FEEDBACK_CONFIG.hitFlashTtlMs,
    x,
    y,
    radius,
    color: isLocal ? "#ef4565" : "#ffffff"
  });
  append({
    type: "damageText",
    targetType,
    ttlMs: FEEDBACK_CONFIG.damageTextTtlMs,
    x,
    y: y - radius - 8,
    text: `-${amount}`,
    color: isLocal ? "#ff8ba7" : "#f7fbff"
  });
}

function mapById(items = []) {
  return new Map(items.map((item) => [item.id, item]));
}
