import { SERVER_MESSAGES } from "../../../shared/protocol/messages.js";
import { deriveAudioEvents } from "../audio/audioEvents.js";
import { deriveDamageEventEffects, deriveEffects, pruneEffects } from "./effects.js";
import { createPredictionState, reconcilePrediction } from "./localPrediction.js";
import {
  createOnboardingState,
  updateOnboardingFromDeath,
  updateOnboardingFromSnapshot
} from "./onboarding.js";

export function createClientState() {
  return {
    screen: "menu",
    playerId: null,
    account: null,
    room: null,
    selectedRoomId: "",
    connected: false,
    error: "",
    publicConfig: null,
    snapshots: [],
    previousSnapshot: null,
    latestSnapshot: null,
    effects: [],
    effectSerial: 1,
    lastLocalXp: 0,
    lastLocalLevel: 1,
    lastLocalUpgradePoints: 0,
    levelPulseUntilMs: 0,
    upgradePulseUntilMs: 0,
    onboarding: createOnboardingState(),
    death: null,
    debugVisible: false,
    fps: 0,
    rttMs: 0,
    lastSnapshotAt: 0,
    renderMetrics: {
      fps: 0,
      frameMs: 0,
      renderMs: 0,
      hudMs: 0,
      renderQuality: "high",
      snapshotAgeMs: 0,
      snapshotBufferSize: 0,
      interpolationMode: "none",
      visibleShapes: 0,
      visibleProjectiles: 0,
      visibleDrones: 0,
      visibleTanks: 0
    },
    audioDebug: null,
    classUpgradeUi: {
      visible: false,
      choices: [],
      tierLevel: null,
      currentClassId: "basic",
      classPath: ["basic"],
      pendingClassId: null
    },
    prediction: createPredictionState(),
    renderQuality: null,
    camera: {
      x: 3000,
      y: 3000,
      scale: 1,
      width: 1,
      height: 1
    }
  };
}

export function applyServerMessage(state, message, now = performance.now()) {
  switch (message.type) {
    case SERVER_MESSAGES.WELCOME:
      state.playerId = message.playerId;
      state.publicConfig = message.config;
      state.account = message.account ?? state.account;
      state.room = message.room ?? null;
      state.connected = true;
      state.screen = "playing";
      state.error = "";
      state.death = null;
      state.effects = [];
      state.previousSnapshot = null;
      state.prediction = createPredictionState(message.config?.prediction);
      return { audioEvents: [] };
    case SERVER_MESSAGES.SNAPSHOT:
      {
        const derived = deriveEffects(state.latestSnapshot, message, state.playerId, now, state.effectSerial);
        const audioEvents = deriveAudioEvents({
          previousSnapshot: state.latestSnapshot,
          nextSnapshot: message,
          playerId: state.playerId,
          visualEffects: derived.effects,
          nowMs: now
        });
        state.effectSerial = derived.nextEffectId;
        state.effects = pruneEffects([...state.effects, ...derived.effects], now);
        state.previousSnapshot = state.latestSnapshot;
        state.lastLocalXp = derived.localUpdates.lastLocalXp;
        state.lastLocalLevel = derived.localUpdates.lastLocalLevel;
        state.lastLocalUpgradePoints = derived.localUpdates.lastLocalUpgradePoints;
        if (derived.localUpdates.levelPulseUntilMs > state.levelPulseUntilMs) {
          state.levelPulseUntilMs = derived.localUpdates.levelPulseUntilMs;
        }
        if (derived.localUpdates.upgradePulseUntilMs > state.upgradePulseUntilMs) {
          state.upgradePulseUntilMs = derived.localUpdates.upgradePulseUntilMs;
        }
        updateOnboardingFromSnapshot(state.onboarding, state.latestSnapshot, message, state.playerId);
      state.latestSnapshot = message;
      reconcilePrediction(
        state.prediction,
        message.tanks.find((tank) => tank.id === state.playerId),
        now,
        state.publicConfig?.prediction
      );
      state.room = message.room ?? state.room;
      state.lastSnapshotAt = now;
      state.snapshots.push({ receivedAt: now, snapshot: message });
      while (state.snapshots.length > 8) {
        state.snapshots.shift();
      }
      if (message.tanks.some((tank) => tank.id === state.playerId && tank.state === "alive")) {
        state.screen = "playing";
        state.death = null;
      }
      return { audioEvents };
    }
    case SERVER_MESSAGES.DEATH:
      state.death = message;
      updateOnboardingFromDeath(state.onboarding, message);
      state.screen = "dead";
      state.levelPulseUntilMs = 0;
      reconcilePrediction(state.prediction, { id: state.playerId, state: "dead" }, now, state.publicConfig?.prediction);
      return {
        audioEvents: deriveAudioEvents({
          playerId: state.playerId,
          deathMessage: message,
          nowMs: now
        })
      };
    case SERVER_MESSAGES.DAMAGE:
      {
        const localTank = getLocalTank(state);
        const derived = deriveDamageEventEffects(message, localTank, now, state.effectSerial);
        state.effectSerial = derived.nextEffectId;
        state.effects = pruneEffects([...state.effects, ...derived.effects], now);
      }
      return { audioEvents: [] };
    case SERVER_MESSAGES.ERROR:
      state.error = message.message;
      if (!state.connected) {
        state.screen = "menu";
      }
      return { audioEvents: [] };
    case SERVER_MESSAGES.PONG:
      state.rttMs = Math.max(0, Math.round(now - message.t));
      return { audioEvents: [] };
  }
  return { audioEvents: [] };
}

export function getLocalTank(state) {
  if (!state.latestSnapshot || !state.playerId) {
    return null;
  }
  return state.latestSnapshot.tanks.find((tank) => tank.id === state.playerId) ?? null;
}

export function getRenderSnapshot(state, now = performance.now()) {
  if (!state.latestSnapshot) {
    updateRenderSnapshotMetrics(state, "none", now);
    return null;
  }

  const delayMs = getInterpolationDelayMs(state);
  const buffer = state.snapshots
    .filter((entry) => entry?.snapshot && Number.isFinite(entry.snapshot.timeMs))
    .sort((a, b) => a.snapshot.timeMs - b.snapshot.timeMs);

  if (buffer.length < 2) {
    const fallback = withRenderMeta(state.latestSnapshot, {
      mode: "latest",
      targetTimeMs: state.latestSnapshot.timeMs,
      sourceCount: buffer.length
    });
    return finishRenderSnapshot(state, fallback, now);
  }

  const latestEntry = buffer[buffer.length - 1];
  const targetTimeMs = latestEntry.snapshot.timeMs + (now - latestEntry.receivedAt) - delayMs;
  const maxGapMs = Math.max(250, delayMs * 3);
  let previousEntry = null;
  let nextEntry = null;

  for (let index = 1; index < buffer.length; index += 1) {
    const previous = buffer[index - 1];
    const next = buffer[index];
    if (previous.snapshot.timeMs <= targetTimeMs && targetTimeMs <= next.snapshot.timeMs) {
      previousEntry = previous;
      nextEntry = next;
      break;
    }
  }

  if (previousEntry && nextEntry && nextEntry.snapshot.timeMs - previousEntry.snapshot.timeMs <= maxGapMs) {
    const interpolated = interpolateSnapshots({
      previous: previousEntry.snapshot,
      next: nextEntry.snapshot,
      targetTimeMs,
      playerId: state.playerId,
      latestSnapshot: state.latestSnapshot,
      now,
      latestReceivedAt: latestEntry.receivedAt
    });
    return finishRenderSnapshot(state, interpolated, now);
  }

  if (targetTimeMs > latestEntry.snapshot.timeMs) {
    const extrapolated = extrapolateLatestSnapshot({
      latest: latestEntry.snapshot,
      playerId: state.playerId,
      elapsedMs: targetTimeMs - latestEntry.snapshot.timeMs,
      sourceCount: buffer.length,
      targetTimeMs
    });
    return finishRenderSnapshot(state, extrapolated, now);
  }

  const fallback = withRenderMeta(state.latestSnapshot, {
    mode: "latest",
    targetTimeMs,
    sourceCount: buffer.length
  });
  return finishRenderSnapshot(state, fallback, now);
}

export function getTankFromSnapshot(snapshot, playerId) {
  if (!snapshot || !playerId) {
    return null;
  }
  return snapshot.tanks.find((tank) => tank.id === playerId) ?? null;
}

export function interpolateSnapshots({
  previous,
  next,
  targetTimeMs,
  playerId = null,
  latestSnapshot = next,
  now = 0,
  latestReceivedAt = now
}) {
  const span = Math.max(1, next.timeMs - previous.timeMs);
  const alpha = clamp01((targetTimeMs - previous.timeMs) / span);
  const previousTanks = mapById(previous.tanks);
  const previousProjectiles = mapById(previous.projectiles);
  const previousDrones = mapById(previous.drones ?? []);
  const tanks = next.tanks.map((tank) => {
    const before = previousTanks.get(tank.id);
    if (!before) {
      return { ...tank };
    }
    return {
      ...tank,
      x: round1(lerp(before.x, tank.x, alpha)),
      y: round1(lerp(before.y, tank.y, alpha)),
      vx: Math.round(lerp(before.vx ?? 0, tank.vx ?? 0, alpha)),
      vy: Math.round(lerp(before.vy ?? 0, tank.vy ?? 0, alpha)),
      angle: lerpAngle(before.angle ?? 0, tank.angle ?? 0, alpha)
    };
  });

  applyLocalVisualExtrapolation({
    tanks,
    latestSnapshot,
    playerId,
    elapsedMs: now - latestReceivedAt
  });

  return {
    ...next,
    tanks,
    projectiles: next.projectiles.map((projectile) => {
      const before = previousProjectiles.get(projectile.id);
      if (!before) {
        return { ...projectile };
      }
      return {
        ...projectile,
        x: round1(lerp(before.x, projectile.x, alpha)),
        y: round1(lerp(before.y, projectile.y, alpha))
      };
    }),
    drones: (next.drones ?? []).map((drone) => {
      const before = previousDrones.get(drone.id);
      if (!before) {
        return { ...drone };
      }
      return {
        ...drone,
        x: round1(lerp(before.x, drone.x, alpha)),
        y: round1(lerp(before.y, drone.y, alpha)),
        angle: lerpAngle(before.angle ?? 0, drone.angle ?? 0, alpha)
      };
    }),
    shapes: latestSnapshot.shapes ?? next.shapes,
    centerObjective: latestSnapshot.centerObjective ?? next.centerObjective,
    leaderboard: latestSnapshot.leaderboard ?? next.leaderboard,
    counts: latestSnapshot.counts ?? next.counts,
    renderMeta: {
      mode: playerId ? "interpolated+local" : "interpolated",
      alpha,
      targetTimeMs,
      sourceCount: 0
    }
  };
}

export function lerpAngle(from, to, alpha) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * alpha;
}

function extrapolateLatestSnapshot({ latest, playerId, elapsedMs, sourceCount, targetTimeMs }) {
  const tanks = latest.tanks.map((tank) => ({ ...tank }));
  applyLocalVisualExtrapolation({ tanks, latestSnapshot: latest, playerId, elapsedMs });
  return {
    ...latest,
    tanks,
    projectiles: latest.projectiles.map((projectile) => ({ ...projectile })),
    drones: (latest.drones ?? []).map((drone) => ({ ...drone })),
    renderMeta: {
      mode: playerId ? "extrapolated-local" : "latest",
      targetTimeMs,
      sourceCount
    }
  };
}

function applyLocalVisualExtrapolation({ tanks, latestSnapshot, playerId, elapsedMs }) {
  if (!playerId || elapsedMs <= 0) {
    return;
  }
  const latestTank = latestSnapshot.tanks.find((tank) => tank.id === playerId);
  const renderTank = tanks.find((tank) => tank.id === playerId);
  if (!latestTank || !renderTank || latestTank.state !== "alive") {
    return;
  }
  const cappedSeconds = Math.min(80, Math.max(0, elapsedMs)) / 1000;
  renderTank.x = round1(latestTank.x + (latestTank.vx ?? 0) * cappedSeconds);
  renderTank.y = round1(latestTank.y + (latestTank.vy ?? 0) * cappedSeconds);
  renderTank.vx = latestTank.vx ?? renderTank.vx;
  renderTank.vy = latestTank.vy ?? renderTank.vy;
  renderTank.angle = latestTank.angle ?? renderTank.angle;
}

function finishRenderSnapshot(state, snapshot, now) {
  const mode = snapshot?.renderMeta?.mode ?? "latest";
  updateRenderSnapshotMetrics(state, mode, now);
  if (snapshot?.renderMeta) {
    snapshot.renderMeta.sourceCount = state.snapshots.length;
  }
  return snapshot;
}

function withRenderMeta(snapshot, renderMeta) {
  return {
    ...snapshot,
    tanks: snapshot.tanks.map((tank) => ({ ...tank })),
    projectiles: snapshot.projectiles.map((projectile) => ({ ...projectile })),
    drones: (snapshot.drones ?? []).map((drone) => ({ ...drone })),
    renderMeta
  };
}

function updateRenderSnapshotMetrics(state, mode, now) {
  state.renderMetrics.snapshotAgeMs = state.lastSnapshotAt > 0
    ? Math.max(0, Math.round(now - state.lastSnapshotAt))
    : 0;
  state.renderMetrics.snapshotBufferSize = state.snapshots.length;
  state.renderMetrics.interpolationMode = mode;
}

function getInterpolationDelayMs(state) {
  return state.publicConfig?.network?.interpolationDelayMs ?? 100;
}

function mapById(items = []) {
  return new Map(items.map((item) => [item.id, item]));
}

function lerp(from, to, alpha) {
  return from + (to - from) * alpha;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
