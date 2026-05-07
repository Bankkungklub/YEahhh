import { AUDIO_CONFIG } from "./audioConfig.js";

export function createMusicPlayer({ config = AUDIO_CONFIG, audioFactory = (path) => new Audio(path) } = {}) {
  let element = null;
  let settings = null;
  let screen = "menu";
  let fadeFrame = 0;
  const state = {
    trackId: config.music.defaultTrack,
    playing: false,
    pausedByUser: false,
    lastError: null
  };

  function ensureElement() {
    if (element) {
      return element;
    }
    const track = config.assets.music[state.trackId];
    element = audioFactory(track.path);
    element.loop = Boolean(track.loop);
    element.preload = "auto";
    element.volume = 0;
    return element;
  }

  async function start(nextSettings) {
    settings = nextSettings ?? settings;
    if (!settings || settings.muted || !settings.musicEnabled) {
      state.pausedByUser = !settings?.musicEnabled;
      return false;
    }
    const audio = ensureElement();
    try {
      await audio.play();
      state.playing = true;
      state.pausedByUser = false;
      fadeTo(getTargetVolume(), config.music.fadeInMs);
      return true;
    } catch (error) {
      state.lastError = error.message;
      return false;
    }
  }

  function updateSettings(nextSettings) {
    settings = nextSettings;
    if (!element) {
      return;
    }
    if (settings.muted || !settings.musicEnabled) {
      fadeTo(0, config.music.fadeOutMs, () => {
        element.pause();
        state.playing = false;
        state.pausedByUser = !settings.musicEnabled;
      });
      return;
    }
    if (state.playing) {
      fadeTo(getTargetVolume(), 160);
    }
  }

  function updateForScreen(nextScreen) {
    screen = nextScreen;
    if (element && state.playing && settings && !settings.muted && settings.musicEnabled) {
      fadeTo(getTargetVolume(), 220);
    }
  }

  function getDebugState() {
    return {
      trackId: state.trackId,
      playing: state.playing,
      pausedByUser: state.pausedByUser,
      volume: element ? Math.round(element.volume * 100) / 100 : 0,
      lastError: state.lastError
    };
  }

  function getTargetVolume() {
    const scale = screen === "dead"
      ? config.music.deadVolumeScale
      : screen === "playing"
        ? config.music.playingVolumeScale
        : config.music.menuVolumeScale;
    return clampVolume((settings?.masterVolume ?? 0) * (settings?.musicVolume ?? 0) * scale);
  }

  function fadeTo(target, durationMs, onDone = null) {
    if (!element) {
      return;
    }
    const startVolume = element.volume;
    const startedAt = performance.now();
    const duration = Math.max(1, durationMs);
    cancelAnimationFrame(fadeFrame);
    const step = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      element.volume = clampVolume(startVolume + (target - startVolume) * progress);
      if (progress < 1) {
        fadeFrame = requestAnimationFrame(step);
      } else {
        onDone?.();
      }
    };
    fadeFrame = requestAnimationFrame(step);
  }

  return { start, updateSettings, updateForScreen, getDebugState };
}

function clampVolume(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}
