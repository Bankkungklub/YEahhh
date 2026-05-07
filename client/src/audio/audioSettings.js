import { AUDIO_CONFIG } from "./audioConfig.js";

export function createDefaultAudioSettings(config = AUDIO_CONFIG) {
  return {
    masterVolume: config.engine.masterDefault,
    musicVolume: config.engine.musicDefault,
    sfxVolume: config.engine.sfxDefault,
    muted: false,
    musicEnabled: true,
    sfxEnabled: true
  };
}

export function sanitizeAudioSettings(value, config = AUDIO_CONFIG) {
  const defaults = createDefaultAudioSettings(config);
  const source = value && typeof value === "object" ? value : {};
  return {
    masterVolume: clampVolume(source.masterVolume, defaults.masterVolume),
    musicVolume: clampVolume(source.musicVolume, defaults.musicVolume),
    sfxVolume: clampVolume(source.sfxVolume, defaults.sfxVolume),
    muted: typeof source.muted === "boolean" ? source.muted : defaults.muted,
    musicEnabled: typeof source.musicEnabled === "boolean" ? source.musicEnabled : defaults.musicEnabled,
    sfxEnabled: typeof source.sfxEnabled === "boolean" ? source.sfxEnabled : defaults.sfxEnabled
  };
}

export function loadAudioSettings(storage = globalThis.localStorage, config = AUDIO_CONFIG) {
  try {
    const raw = storage?.getItem?.(config.settings.storageKey);
    if (!raw) {
      return createDefaultAudioSettings(config);
    }
    return sanitizeAudioSettings(JSON.parse(raw), config);
  } catch {
    return createDefaultAudioSettings(config);
  }
}

export function saveAudioSettings(settings, storage = globalThis.localStorage, config = AUDIO_CONFIG) {
  const clean = sanitizeAudioSettings(settings, config);
  try {
    storage?.setItem?.(config.settings.storageKey, JSON.stringify(clean));
  } catch {
    // Audio settings are convenience state. Blocked storage should never break play.
  }
  return clean;
}

export function patchAudioSettings(current, patch, config = AUDIO_CONFIG) {
  return sanitizeAudioSettings({ ...current, ...patch }, config);
}

function clampVolume(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.min(1, numeric));
}
