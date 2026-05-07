export const RENDER_QUALITY_CONFIG = Object.freeze({
  mediumFpsThreshold: 54,
  lowFpsThreshold: 44,
  recoverMediumFps: 56,
  recoverHighFps: 60,
  downgradeHoldMs: 2000,
  recoverHoldMs: 4000,
  lowEffectCap: 32,
  mediumEffectCap: 52,
  highEffectCap: 80,
  projectileTrailBudget: {
    high: Infinity,
    medium: 80,
    low: 0
  }
});

export function createRenderQualityState() {
  return {
    mode: "high",
    belowSinceMs: 0,
    recoverSinceMs: 0,
    flags: getQualityFlags("high")
  };
}

export function updateRenderQuality(state, metrics, nowMs, config = RENDER_QUALITY_CONFIG) {
  if (!state) {
    return createRenderQualityState();
  }

  const fps = Number(metrics?.fps) || 60;
  let nextMode = state.mode;

  if (state.mode === "high" && fps < config.mediumFpsThreshold) {
    state.belowSinceMs ||= nowMs;
    if (nowMs - state.belowSinceMs >= config.downgradeHoldMs) {
      nextMode = "medium";
      state.belowSinceMs = 0;
    }
  } else if (state.mode === "medium" && fps < config.lowFpsThreshold) {
    state.belowSinceMs ||= nowMs;
    if (nowMs - state.belowSinceMs >= config.downgradeHoldMs) {
      nextMode = "low";
      state.belowSinceMs = 0;
    }
  } else if (state.mode === "low" && fps > config.recoverMediumFps) {
    state.recoverSinceMs ||= nowMs;
    if (nowMs - state.recoverSinceMs >= config.recoverHoldMs) {
      nextMode = "medium";
      state.recoverSinceMs = 0;
    }
  } else if (state.mode === "medium" && fps > config.recoverHighFps) {
    state.recoverSinceMs ||= nowMs;
    if (nowMs - state.recoverSinceMs >= config.recoverHoldMs) {
      nextMode = "high";
      state.recoverSinceMs = 0;
    }
  } else {
    state.belowSinceMs = 0;
    state.recoverSinceMs = 0;
  }

  if (nextMode !== state.mode) {
    state.mode = nextMode;
    state.flags = getQualityFlags(nextMode, config);
  }
  return state;
}

export function getQualityFlags(mode, config = RENDER_QUALITY_CONFIG) {
  if (mode === "low") {
    return {
      mode,
      drawClouds: false,
      drawGrassBands: false,
      drawProjectileTrails: false,
      effectCap: config.lowEffectCap,
      projectileTrailBudget: config.projectileTrailBudget.low
    };
  }
  if (mode === "medium") {
    return {
      mode,
      drawClouds: false,
      drawGrassBands: true,
      drawProjectileTrails: true,
      effectCap: config.mediumEffectCap,
      projectileTrailBudget: config.projectileTrailBudget.medium
    };
  }
  return {
    mode: "high",
    drawClouds: true,
    drawGrassBands: true,
    drawProjectileTrails: true,
    effectCap: config.highEffectCap,
    projectileTrailBudget: config.projectileTrailBudget.high
  };
}
