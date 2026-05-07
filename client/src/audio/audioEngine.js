import { AUDIO_CONFIG } from "./audioConfig.js";
import { createAudioEventLimiter, getDistanceGain } from "./audioEvents.js";
import { loadAudioSettings, patchAudioSettings, saveAudioSettings } from "./audioSettings.js";
import { createMusicPlayer } from "./musicPlayer.js";
import { createSfxPlayer } from "./sfxPlayer.js";

export function createAudioController({
  config = AUDIO_CONFIG,
  storage = globalThis.localStorage,
  windowRef = globalThis.window
} = {}) {
  let settings = loadAudioSettings(storage, config);
  let context = null;
  let masterGain = null;
  let sfxGain = null;
  let sfxPlayer = null;
  let unlockPromise = null;
  const limiter = createAudioEventLimiter(config);
  const musicPlayer = createMusicPlayer({ config });
  const state = {
    unlocked: false,
    disabled: !config.engine.enabled,
    contextState: "none",
    assetsReady: false,
    lastError: null
  };

  async function unlock() {
    if (state.disabled) {
      return false;
    }
    if (state.unlocked && context?.state === "running") {
      return true;
    }
    if (unlockPromise) {
      return unlockPromise;
    }
    unlockPromise = doUnlock().finally(() => {
      unlockPromise = null;
    });
    return unlockPromise;
  }

  async function doUnlock() {
    try {
      const AudioContextCtor = windowRef?.AudioContext ?? windowRef?.webkitAudioContext;
      if (!AudioContextCtor) {
        state.disabled = true;
        state.lastError = "AudioContext unavailable";
        return false;
      }
      if (!context) {
        context = new AudioContextCtor();
        masterGain = context.createGain();
        sfxGain = context.createGain();
        sfxGain.connect(masterGain);
        masterGain.connect(context.destination);
        sfxPlayer = createSfxPlayer({ context, output: sfxGain, config });
        applyGainSettings();
      }
      if (context.state === "suspended") {
        await context.resume();
      }
      state.unlocked = true;
      state.contextState = context.state;
      sfxPlayer.load().then((loadState) => {
        state.assetsReady = loadState.loadedCount > 0;
      });
      await musicPlayer.start(settings);
      return true;
    } catch (error) {
      state.lastError = error.message;
      return false;
    }
  }

  function handleAudioEvents(events = [], nowMs = performance.now(), localTank = null) {
    if (!events.length || settings.muted || !settings.sfxEnabled || state.disabled) {
      return;
    }
    if (!state.unlocked) {
      return;
    }
    applyGainSettings();
    const sorted = [...events].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    for (const event of sorted) {
      if (!limiter.accept(event, nowMs)) {
        continue;
      }
      const distanceGain = getDistanceGain(event, localTank, config);
      const eventGain = Number.isFinite(event.gain) ? event.gain : 1;
      sfxPlayer?.playSfx(event.role, {
        gainScale: eventGain * distanceGain,
        pitchScale: event.pitchScale ?? 1,
        priority: event.priority ?? 1
      });
    }
  }

  function playUiClick() {
    unlock().then(() => {
      handleAudioEvents([{ role: "uiClick", bucket: "ui", priority: config.sfxRules.priority.uiClick, local: true }]);
    });
  }

  function updateForScreen(screen) {
    musicPlayer.updateForScreen(screen);
  }

  function updateSettings(patch) {
    settings = saveAudioSettings(patchAudioSettings(settings, patch, config), storage, config);
    applyGainSettings();
    musicPlayer.updateSettings(settings);
    if (!settings.muted && settings.musicEnabled && state.unlocked) {
      musicPlayer.start(settings);
    }
    return settings;
  }

  function getSettings() {
    return { ...settings };
  }

  function getDebugState() {
    if (context) {
      state.contextState = context.state;
    }
    return {
      unlocked: state.unlocked,
      disabled: state.disabled,
      muted: settings.muted,
      musicEnabled: settings.musicEnabled,
      sfxEnabled: settings.sfxEnabled,
      masterVolume: settings.masterVolume,
      musicVolume: settings.musicVolume,
      sfxVolume: settings.sfxVolume,
      contextState: state.contextState,
      assetsReady: state.assetsReady,
      sfx: sfxPlayer?.getDebugState() ?? null,
      eventsPerSecond: limiter.getStats(),
      music: musicPlayer.getDebugState(),
      lastError: state.lastError
    };
  }

  function applyGainSettings() {
    if (masterGain) {
      masterGain.gain.value = settings.muted ? 0 : settings.masterVolume;
    }
    if (sfxGain) {
      sfxGain.gain.value = settings.sfxEnabled ? settings.sfxVolume : 0;
    }
  }

  return {
    unlock,
    handleAudioEvents,
    playUiClick,
    updateForScreen,
    updateSettings,
    getSettings,
    getDebugState
  };
}
