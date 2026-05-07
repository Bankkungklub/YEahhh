export function createServerHealth({
  now = () => Date.now(),
  nodeEnv = "development",
  version = "1.0.0"
} = {}) {
  const state = {
    startedAtMs: now(),
    ready: false,
    draining: false,
    storageReady: false,
    storageError: "",
    nodeEnv,
    version
  };

  return {
    markStorageReady() {
      state.storageReady = true;
      state.storageError = "";
      state.ready = !state.draining;
    },
    markStorageError(error) {
      state.storageReady = false;
      state.storageError = error?.message || String(error || "Storage unavailable.");
      state.ready = false;
    },
    markReady() {
      state.ready = state.storageReady && !state.draining;
    },
    markDraining() {
      state.draining = true;
      state.ready = false;
    },
    snapshot(extra = {}) {
      return createHealthSnapshot(state, { nowMs: now(), ...extra });
    },
    isReady() {
      return isReady(state);
    }
  };
}

export function createHealthSnapshot(state, {
  nowMs = Date.now(),
  rooms = null,
  clients = null
} = {}) {
  return {
    ok: !state.draining,
    ready: isReady(state),
    draining: Boolean(state.draining),
    storageReady: Boolean(state.storageReady),
    uptimeMs: Math.max(0, Math.round(nowMs - state.startedAtMs)),
    nodeEnv: state.nodeEnv,
    version: state.version,
    rooms,
    clients,
    storageError: state.storageError || undefined
  };
}

export function isReady(state) {
  return Boolean(state?.ready && state?.storageReady && !state?.draining);
}
