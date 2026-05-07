import { GAME_CONFIG, getTankStats } from "../../../shared/config/gameConfig.js";
import { COMBAT_FEEL_CONFIG } from "../../../shared/config/combatFeelConfig.js";
import { getClassAdjustedTankStats, getWeaponPattern } from "../../../shared/sim/tankClasses.js";
import { clampMotionToWorld, simulateTankMotion } from "../../../shared/sim/tankMotion.js";
import { applyRecoilImpulse, computeFireRecoilImpulse, decayRecoilVelocity, summarizeRecoilImpulse } from "../../../shared/sim/tankRecoil.js";

const DEFAULT_CONFIG = GAME_CONFIG.prediction;

export function createPredictionState(config = DEFAULT_CONFIG) {
  return {
    enabled: config.enabled,
    predictedTank: null,
    pendingInputs: [],
    lastServerSeq: 0,
    lastFrameAtMs: 0,
    correctionX: 0,
    correctionY: 0,
    errorPx: 0,
    lastFireImpulse: null,
    mode: "idle"
  };
}

export function recordLocalInput(prediction, input, nowMs = 0, config = DEFAULT_CONFIG) {
  if (!prediction?.enabled || !input || !Number.isFinite(Number(input.seq))) {
    return prediction;
  }
  prediction.pendingInputs.push({
    seq: Math.max(0, Math.trunc(Number(input.seq) || 0)),
    moveX: input.moveX,
    moveY: input.moveY,
    aimAngle: input.aimAngle,
    fire: Boolean(input.fire),
    sentAtMs: nowMs
  });
  if (prediction.pendingInputs.length > config.maxPendingInputs) {
    prediction.pendingInputs.splice(0, prediction.pendingInputs.length - config.maxPendingInputs);
  }
  return prediction;
}

export function applyPredictionFrame({
  prediction,
  input,
  dtMs,
  serverTank,
  world,
  nowMs = 0,
  config = DEFAULT_CONFIG
}) {
  if (!prediction?.enabled || !serverTank || serverTank.state !== "alive") {
    disablePrediction(prediction);
    return null;
  }

  if (!prediction.predictedTank || shouldReseedPrediction(prediction.predictedTank, serverTank)) {
    seedPrediction(prediction, serverTank, nowMs);
  }

  const safeDtMs = Math.min(config.maxFrameDtMs, Math.max(0, Number(dtMs) || 0));
  const safeDtSeconds = safeDtMs / 1000;
  decayVisualCorrection(prediction, safeDtMs, config);
  const stats = getPredictedTankStats(prediction.predictedTank);
  const recoilX = Number(prediction.predictedTank.recoilX) || 0;
  const recoilY = Number(prediction.predictedTank.recoilY) || 0;
  const motion = simulateTankMotion({
    tank: prediction.predictedTank,
    input,
    moveSpeed: stats.moveSpeed,
    dtSeconds: safeDtSeconds,
    world
  });
  const recoilPosition = clampMotionToWorld({
    x: motion.x + recoilX * safeDtSeconds,
    y: motion.y + recoilY * safeDtSeconds,
    radius: prediction.predictedTank.radius,
    world
  });

  const nextTank = {
    ...prediction.predictedTank,
    x: recoilPosition.x,
    y: recoilPosition.y,
    vx: motion.vx + recoilX,
    vy: motion.vy + recoilY,
    recoilX,
    recoilY,
    fireCooldownMs: Math.max(0, Number(prediction.predictedTank.fireCooldownMs) || 0) - safeDtMs,
    angle: Number.isFinite(Number(input?.aimAngle)) ? Number(input.aimAngle) : prediction.predictedTank.angle
  };
  nextTank.fireCooldownMs = Math.max(0, nextTank.fireCooldownMs);
  decayRecoilVelocity(nextTank, safeDtSeconds, COMBAT_FEEL_CONFIG);
  maybePredictFireRecoil(nextTank, input, stats, prediction);

  prediction.predictedTank = nextTank;
  prediction.lastFrameAtMs = nowMs;
  prediction.mode = Math.hypot(prediction.correctionX, prediction.correctionY) > 0.5
    ? "correcting"
    : "predicting";
  return prediction.predictedTank;
}

export function reconcilePrediction(prediction, serverTank, nowMs = 0, config = DEFAULT_CONFIG) {
  if (!prediction?.enabled || !serverTank || serverTank.state !== "alive") {
    disablePrediction(prediction);
    return prediction;
  }

  const serverSeq = Math.max(0, Math.trunc(Number(serverTank.lastInputSeq) || 0));
  prediction.lastServerSeq = Math.max(prediction.lastServerSeq, serverSeq);
  prediction.pendingInputs = prediction.pendingInputs.filter((input) => input.seq > prediction.lastServerSeq);

  if (!prediction.predictedTank || shouldReseedPrediction(prediction.predictedTank, serverTank)) {
    seedPrediction(prediction, serverTank, nowMs);
    return prediction;
  }

  prediction.predictedTank = {
    ...serverTank,
    x: prediction.predictedTank.x,
    y: prediction.predictedTank.y,
    vx: prediction.predictedTank.vx,
    vy: prediction.predictedTank.vy,
    angle: prediction.predictedTank.angle
  };

  const dx = serverTank.x - prediction.predictedTank.x;
  const dy = serverTank.y - prediction.predictedTank.y;
  const error = Math.hypot(dx, dy);
  prediction.errorPx = Math.round(error * 10) / 10;

  if (error >= config.snapThresholdPx) {
    seedPrediction(prediction, serverTank, nowMs);
    prediction.errorPx = Math.round(error * 10) / 10;
    prediction.mode = "predicting";
    return prediction;
  }

  if (error >= config.correctionThresholdPx) {
    const visibleX = prediction.predictedTank.x + prediction.correctionX;
    const visibleY = prediction.predictedTank.y + prediction.correctionY;
    const blend = Math.max(0.01, Math.min(1, config.correctionBlend ?? DEFAULT_CONFIG.correctionBlend ?? 0.32));
    prediction.predictedTank.x += dx * blend;
    prediction.predictedTank.y += dy * blend;
    prediction.correctionX = visibleX - prediction.predictedTank.x;
    prediction.correctionY = visibleY - prediction.predictedTank.y;
    prediction.mode = "correcting";
  }
  return prediction;
}

export function getPredictedLocalTank(prediction, snapshot, playerId, nowMs = 0) {
  if (!prediction?.enabled || !snapshot || !playerId || !prediction.predictedTank) {
    return null;
  }
  const serverTank = snapshot.tanks.find((tank) => tank.id === playerId);
  if (!serverTank || serverTank.state !== "alive" || prediction.predictedTank.state !== "alive") {
    return null;
  }
  return {
    ...serverTank,
    x: prediction.predictedTank.x + prediction.correctionX,
    y: prediction.predictedTank.y + prediction.correctionY,
    vx: prediction.predictedTank.vx,
    vy: prediction.predictedTank.vy,
    angle: prediction.predictedTank.angle
  };
}

export function getPredictionDebugState(prediction) {
  return {
    mode: prediction?.mode ?? "none",
    pendingInputs: prediction?.pendingInputs?.length ?? 0,
    lastServerSeq: prediction?.lastServerSeq ?? 0,
    errorPx: prediction?.errorPx ?? 0,
    correctionX: Math.round((prediction?.correctionX ?? 0) * 10) / 10,
    correctionY: Math.round((prediction?.correctionY ?? 0) * 10) / 10,
    recoilX: Math.round((prediction?.predictedTank?.recoilX ?? 0) * 10) / 10,
    recoilY: Math.round((prediction?.predictedTank?.recoilY ?? 0) * 10) / 10,
    recoilSpeed: Math.round(Math.hypot(
      prediction?.predictedTank?.recoilX ?? 0,
      prediction?.predictedTank?.recoilY ?? 0
    ) * 10) / 10,
    lastFireImpulse: prediction?.lastFireImpulse ?? null
  };
}

export function seedPrediction(prediction, serverTank, nowMs = 0) {
  prediction.predictedTank = { ...serverTank };
  prediction.pendingInputs = [];
  prediction.lastServerSeq = Math.max(0, Math.trunc(Number(serverTank.lastInputSeq) || 0));
  prediction.correctionX = 0;
  prediction.correctionY = 0;
  prediction.errorPx = 0;
  prediction.lastFireImpulse = null;
  prediction.mode = "predicting";
  return prediction;
}

export function disablePrediction(prediction) {
  if (!prediction) {
    return null;
  }
  prediction.predictedTank = null;
  prediction.pendingInputs = [];
  prediction.correctionX = 0;
  prediction.correctionY = 0;
  prediction.errorPx = 0;
  prediction.lastFireImpulse = null;
  prediction.mode = prediction.enabled ? "idle" : "disabled";
  return prediction;
}

function getPredictedTankStats(tank) {
  return getClassAdjustedTankStats(getTankStats(tank.upgrades ?? {}), tank.classId);
}

function maybePredictFireRecoil(tank, input, stats, prediction) {
  if (!COMBAT_FEEL_CONFIG.recoil.localPrediction || !input?.fire || tank.fireCooldownMs > 0) {
    return false;
  }
  const impulse = computeFireRecoilImpulse({
    tank,
    shots: getWeaponPattern(tank.classId),
    aimAngle: Number.isFinite(Number(input?.aimAngle)) ? Number(input.aimAngle) : tank.angle,
    classRecoilMultiplier: stats.recoilMultiplier ?? 1,
    baseProjectileRadius: GAME_CONFIG.projectile.radius,
    config: COMBAT_FEEL_CONFIG
  });
  applyRecoilImpulse(tank, impulse, COMBAT_FEEL_CONFIG);
  tank.fireCooldownMs = Math.max(0, stats.reloadMs);
  prediction.lastFireImpulse = summarizeRecoilImpulse(impulse);
  return true;
}

function decayVisualCorrection(prediction, dtMs, config) {
  const correctionMs = Math.max(1, Number(config.correctionMs) || DEFAULT_CONFIG.correctionMs || 140);
  const decay = Math.max(0, 1 - dtMs / correctionMs);
  prediction.correctionX *= decay;
  prediction.correctionY *= decay;
  if (Math.hypot(prediction.correctionX, prediction.correctionY) < 0.25) {
    prediction.correctionX = 0;
    prediction.correctionY = 0;
  }
}

function shouldReseedPrediction(predictedTank, serverTank) {
  return (
    predictedTank.id !== serverTank.id ||
    predictedTank.state !== serverTank.state ||
    predictedTank.classId !== serverTank.classId ||
    JSON.stringify(predictedTank.upgrades ?? {}) !== JSON.stringify(serverTank.upgrades ?? {})
  );
}
