import { TOUCH_CONTROLS_CONFIG } from "./touchControlsConfig.js";

export function createTouchControlsState(options = {}) {
  const config = normalizeTouchControlsConfig(options.config ?? options);
  return {
    enabled: false,
    gameplayActive: false,
    moveTouchId: null,
    aimTouchId: null,
    moveOrigin: null,
    moveCurrent: null,
    aimOrigin: null,
    aimCurrent: null,
    lastAimAngle: 0,
    firing: false,
    fireLocked: false,
    visibleUntilMs: 0,
    config
  };
}

export function normalizeTouchControlsConfig(config = {}) {
  return {
    mobileMaxWidth: positiveNumber(config.mobileMaxWidth, TOUCH_CONTROLS_CONFIG.mobileMaxWidth),
    stickRadiusPx: positiveNumber(config.stickRadiusPx, TOUCH_CONTROLS_CONFIG.stickRadiusPx),
    stickVisualRadiusPx: positiveNumber(config.stickVisualRadiusPx, TOUCH_CONTROLS_CONFIG.stickVisualRadiusPx),
    knobRadiusPx: positiveNumber(config.knobRadiusPx, TOUCH_CONTROLS_CONFIG.knobRadiusPx),
    deadZonePx: positiveNumber(config.deadZonePx, TOUCH_CONTROLS_CONFIG.deadZonePx),
    maxVectorPx: positiveNumber(config.maxVectorPx, TOUCH_CONTROLS_CONFIG.maxVectorPx),
    leftZoneRatio: clampNumber(config.leftZoneRatio, 0.2, 0.8, TOUCH_CONTROLS_CONFIG.leftZoneRatio),
    fireLockEnabled: config.fireLockEnabled !== false,
    overlayFadeMs: positiveNumber(config.overlayFadeMs, TOUCH_CONTROLS_CONFIG.overlayFadeMs)
  };
}

export function setTouchGameplayActive(state, active, nowMs = 0) {
  if (!state) {
    return state;
  }
  state.gameplayActive = Boolean(active);
  if (!state.gameplayActive) {
    resetTouchControls(state, { clearLock: true });
    state.enabled = false;
    return state;
  }
  state.enabled = true;
  state.visibleUntilMs = Math.max(state.visibleUntilMs ?? 0, Number(nowMs) || 0);
  return state;
}

export function isTouchControlsEnabled({
  viewport = {},
  maxTouchPoints = 0,
  coarsePointer = false,
  config = TOUCH_CONTROLS_CONFIG
} = {}) {
  const safeConfig = normalizeTouchControlsConfig(config);
  const width = positiveNumber(viewport.width, Number.POSITIVE_INFINITY);
  return Boolean(coarsePointer || maxTouchPoints > 0 || width <= safeConfig.mobileMaxWidth);
}

export function handleTouchStart(state, touches, viewport, nowMs = 0) {
  if (!state?.gameplayActive) {
    return state;
  }

  const config = state.config ?? TOUCH_CONTROLS_CONFIG;
  markVisible(state, nowMs);
  for (const touch of toTouchArray(touches)) {
    const id = getTouchId(touch);
    if (id === null || isAssigned(state, id)) {
      continue;
    }

    const point = touchPoint(touch);
    const role = point.x < positiveNumber(viewport?.width, 0) * config.leftZoneRatio
      ? "move"
      : "aim";

    if (role === "move" && state.moveTouchId === null) {
      state.moveTouchId = id;
      state.moveOrigin = point;
      state.moveCurrent = point;
    } else if (role === "aim" && state.aimTouchId === null) {
      state.aimTouchId = id;
      state.aimOrigin = point;
      state.aimCurrent = point;
    }
  }
  refreshFiringState(state);
  return state;
}

export function handleTouchMove(state, touches, viewport, nowMs = 0) {
  if (!state?.gameplayActive) {
    return state;
  }

  state.enabled = isTouchControlsEnabled({
    viewport,
    config: state.config
  });
  markVisible(state, nowMs);
  for (const touch of toTouchArray(touches)) {
    const id = getTouchId(touch);
    const point = touchPoint(touch);
    if (id === state.moveTouchId) {
      state.moveCurrent = point;
    } else if (id === state.aimTouchId) {
      state.aimCurrent = point;
    }
  }
  refreshFiringState(state);
  return state;
}

export function handleTouchEnd(state, changedTouches, nowMs = 0) {
  if (!state) {
    return state;
  }

  markVisible(state, nowMs);
  for (const touch of toTouchArray(changedTouches)) {
    const id = getTouchId(touch);
    if (id === state.moveTouchId) {
      state.moveTouchId = null;
    }
    if (id === state.aimTouchId) {
      state.aimTouchId = null;
    }
  }
  refreshFiringState(state);
  return state;
}

export function toggleTouchFireLock(state, nowMs = 0) {
  if (!state?.config?.fireLockEnabled || !state.gameplayActive) {
    return state;
  }
  state.fireLocked = !state.fireLocked;
  markVisible(state, nowMs);
  refreshFiringState(state);
  return state;
}

export function resetTouchControls(state, { clearLock = true } = {}) {
  if (!state) {
    return state;
  }
  state.moveTouchId = null;
  state.aimTouchId = null;
  state.moveOrigin = null;
  state.moveCurrent = null;
  state.aimOrigin = null;
  state.aimCurrent = null;
  state.firing = false;
  state.visibleUntilMs = 0;
  if (clearLock) {
    state.fireLocked = false;
  }
  return state;
}

export function buildTouchInput(state, {
  camera = null,
  localTank = null,
  fallbackAimAngle = 0
} = {}) {
  const active = Boolean(state?.gameplayActive && (
    state.moveTouchId !== null ||
    state.aimTouchId !== null ||
    state.fireLocked
  ));
  if (!active) {
    return {
      active: false,
      moveX: 0,
      moveY: 0,
      aimAngle: finiteAngle(fallbackAimAngle, 0),
      fire: false
    };
  }

  const move = getTouchMoveVector(state);
  const aimAngle = deriveAimAngle(state, { camera, localTank, fallbackAimAngle });
  return {
    active: true,
    moveX: move.x,
    moveY: move.y,
    aimAngle,
    fire: Boolean(state.firing || state.fireLocked)
  };
}

export function getTouchMoveVector(state) {
  if (!state?.moveOrigin || !state.moveCurrent || state.moveTouchId === null) {
    return { x: 0, y: 0, magnitude: 0 };
  }
  return getClampedStickVector(state.moveOrigin, state.moveCurrent, state.config);
}

export function getTouchOverlayViewModel(state, {
  viewport = {},
  nowMs = 0,
  gameplayActive = state?.gameplayActive ?? false,
  maxTouchPoints = 0,
  coarsePointer = false
} = {}) {
  const config = state?.config ?? TOUCH_CONTROLS_CONFIG;
  const enabled = isTouchControlsEnabled({
    viewport,
    maxTouchPoints,
    coarsePointer,
    config
  });
  if (state) {
    state.enabled = enabled;
  }

  const visible = Boolean(enabled && gameplayActive);
  const fadeVisible = Boolean(nowMs <= (state?.visibleUntilMs ?? 0));
  return {
    enabled,
    visible,
    fireLockVisible: Boolean(visible && config.fireLockEnabled),
    fireLocked: Boolean(state?.fireLocked),
    firing: Boolean(state?.firing),
    stickRadiusPx: positiveNumber(config.stickVisualRadiusPx, TOUCH_CONTROLS_CONFIG.stickVisualRadiusPx),
    knobRadiusPx: positiveNumber(config.knobRadiusPx, TOUCH_CONTROLS_CONFIG.knobRadiusPx),
    move: makeStickView({
      origin: state?.moveOrigin,
      current: state?.moveCurrent,
      active: state?.moveTouchId !== null,
      fadeVisible,
      config,
      label: "MOVE"
    }),
    aim: makeStickView({
      origin: state?.aimOrigin,
      current: state?.aimCurrent,
      active: state?.aimTouchId !== null,
      fadeVisible,
      config,
      label: "AIM"
    })
  };
}

function deriveAimAngle(state, { camera, localTank, fallbackAimAngle }) {
  if (state.aimTouchId !== null && state.aimCurrent) {
    if (localTank && camera) {
      const worldPoint = screenToWorld(state.aimCurrent.x, state.aimCurrent.y, camera);
      const angle = Math.atan2(worldPoint.y - localTank.y, worldPoint.x - localTank.x);
      state.lastAimAngle = finiteAngle(angle, state.lastAimAngle);
      return state.lastAimAngle;
    }

    if (state.aimOrigin) {
      const vector = getClampedStickVector(state.aimOrigin, state.aimCurrent, state.config);
      if (vector.magnitude > 0) {
        state.lastAimAngle = finiteAngle(Math.atan2(vector.y, vector.x), state.lastAimAngle);
        return state.lastAimAngle;
      }
    }
  }

  const tankAngle = localTank?.aimAngle ?? localTank?.angle;
  return finiteAngle(state.lastAimAngle, finiteAngle(tankAngle, finiteAngle(fallbackAimAngle, 0)));
}

function makeStickView({ origin, current, active, fadeVisible, config, label }) {
  const visible = Boolean(origin && (active || fadeVisible));
  const clamped = origin && current
    ? getClampedStickPoint(origin, current, config)
    : origin;
  return {
    label,
    visible,
    active: Boolean(active),
    baseX: Math.round(origin?.x ?? 0),
    baseY: Math.round(origin?.y ?? 0),
    knobX: Math.round(clamped?.x ?? origin?.x ?? 0),
    knobY: Math.round(clamped?.y ?? origin?.y ?? 0)
  };
}

function getClampedStickVector(origin, current, config = TOUCH_CONTROLS_CONFIG) {
  const dx = (current?.x ?? origin?.x ?? 0) - (origin?.x ?? 0);
  const dy = (current?.y ?? origin?.y ?? 0) - (origin?.y ?? 0);
  const length = Math.hypot(dx, dy);
  const deadZone = positiveNumber(config.deadZonePx, TOUCH_CONTROLS_CONFIG.deadZonePx);
  const maxVector = positiveNumber(config.maxVectorPx, TOUCH_CONTROLS_CONFIG.maxVectorPx);
  if (length <= deadZone || maxVector <= 0) {
    return { x: 0, y: 0, magnitude: 0 };
  }
  const clamped = Math.min(length, maxVector);
  const magnitude = clamped / maxVector;
  return {
    x: (dx / length) * magnitude,
    y: (dy / length) * magnitude,
    magnitude
  };
}

function getClampedStickPoint(origin, current, config = TOUCH_CONTROLS_CONFIG) {
  const dx = (current?.x ?? origin.x) - origin.x;
  const dy = (current?.y ?? origin.y) - origin.y;
  const length = Math.hypot(dx, dy);
  const maxVector = positiveNumber(config.maxVectorPx, TOUCH_CONTROLS_CONFIG.maxVectorPx);
  if (length <= 0.00001) {
    return origin;
  }
  const clamped = Math.min(length, maxVector);
  return {
    x: origin.x + (dx / length) * clamped,
    y: origin.y + (dy / length) * clamped
  };
}

function markVisible(state, nowMs) {
  state.visibleUntilMs = Math.max(state.visibleUntilMs ?? 0, (Number(nowMs) || 0) + state.config.overlayFadeMs);
}

function refreshFiringState(state) {
  state.firing = Boolean(state.aimTouchId !== null || state.fireLocked);
}

function isAssigned(state, id) {
  return id === state.moveTouchId || id === state.aimTouchId;
}

function toTouchArray(touches) {
  return Array.from(touches ?? []);
}

function getTouchId(touch) {
  const id = touch?.identifier ?? touch?.id;
  const numeric = Number(id);
  return Number.isFinite(numeric) ? numeric : null;
}

function touchPoint(touch) {
  return {
    x: finiteNumber(touch?.clientX, 0),
    y: finiteNumber(touch?.clientY, 0)
  };
}

function screenToWorld(x, y, camera) {
  const scale = positiveNumber(camera?.scale, 1);
  return {
    x: finiteNumber(camera?.x, 0) + (x - finiteNumber(camera?.width, 0) / 2) / scale,
    y: finiteNumber(camera?.y, 0) + (y - finiteNumber(camera?.height, 0) / 2) / scale
  };
}

function finiteAngle(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function finiteNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function positiveNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, numeric));
}
