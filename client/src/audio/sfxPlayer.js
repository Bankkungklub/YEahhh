import { AUDIO_CONFIG, REQUIRED_SFX_ROLES } from "./audioConfig.js";

export function createSfxPlayer({ context, output, config = AUDIO_CONFIG }) {
  const buffers = new Map();
  const failedRoles = new Set();
  const activeVoices = [];
  let loaded = false;
  let loading = null;

  async function load() {
    if (loaded) {
      return getLoadState();
    }
    if (loading) {
      return loading;
    }
    loading = Promise.all(REQUIRED_SFX_ROLES.map(async (role) => {
      try {
        const response = await fetch(config.assets.sfx[role]);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(data.slice(0));
        buffers.set(role, buffer);
      } catch {
        failedRoles.add(role);
      }
    })).then(() => {
      loaded = true;
      return getLoadState();
    });
    return loading;
  }

  function playSfx(role, { gainScale = 1, pitchScale = 1, priority = 1 } = {}) {
    pruneVoices();
    if (activeVoices.length >= config.engine.maxSimultaneousSfx && !freeVoiceSlot(priority)) {
      return false;
    }
    const buffer = buffers.get(role);
    if (!buffer) {
      playFallback(role, gainScale, priority, pitchScale);
      return false;
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = getPitch(role, config, pitchScale);
    gain.gain.value = Math.max(0, gainScale * (config.sfx[role]?.gain ?? 0.4));
    source.connect(gain);
    gain.connect(output);
    const voice = { source, priority, ended: false };
    activeVoices.push(voice);
    source.onended = () => {
      voice.ended = true;
    };
    source.start();
    return true;
  }

  function getLoadState() {
    return {
      loaded,
      loadedCount: buffers.size,
      failedCount: failedRoles.size,
      failedRoles: [...failedRoles]
    };
  }

  function getDebugState() {
    pruneVoices();
    return {
      ...getLoadState(),
      activeVoices: activeVoices.length,
      maxVoices: config.engine.maxSimultaneousSfx
    };
  }

  function freeVoiceSlot(priority) {
    pruneVoices();
    const lowest = activeVoices
      .map((voice, index) => ({ voice, index }))
      .sort((a, b) => a.voice.priority - b.voice.priority)[0];
    if (!lowest || lowest.voice.priority > priority) {
      return false;
    }
    try {
      lowest.voice.source.stop();
    } catch {
      // Source may already be stopped. The prune pass below will remove it.
    }
    lowest.voice.ended = true;
    pruneVoices();
    return true;
  }

  function pruneVoices() {
    for (let index = activeVoices.length - 1; index >= 0; index -= 1) {
      if (activeVoices[index].ended) {
        activeVoices.splice(index, 1);
      }
    }
  }

  function playFallback(role, gainScale, priority, pitchScale = 1) {
    pruneVoices();
    if (activeVoices.length >= config.engine.maxSimultaneousSfx && !freeVoiceSlot(priority)) {
      return;
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const fallback = getFallbackTone(role);
    const safePitchScale = clampPitchScale(pitchScale);
    oscillator.type = fallback.type;
    oscillator.frequency.setValueAtTime(fallback.startHz * safePitchScale, now);
    oscillator.frequency.exponentialRampToValueAtTime(fallback.endHz * safePitchScale, now + fallback.seconds);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, fallback.gain * gainScale), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + fallback.seconds);
    oscillator.connect(gain);
    gain.connect(output);
    const voice = { source: oscillator, priority, ended: false };
    activeVoices.push(voice);
    oscillator.onended = () => {
      voice.ended = true;
    };
    oscillator.start(now);
    oscillator.stop(now + fallback.seconds);
  }

  return { load, playSfx, getLoadState, getDebugState };
}

function getPitch(role, config, pitchScale = 1) {
  const tuning = config.sfx[role] ?? { pitchMin: 1, pitchMax: 1 };
  const safePitchScale = clampPitchScale(pitchScale);
  if (tuning.pitchMax <= tuning.pitchMin) {
    return tuning.pitchMin * safePitchScale;
  }
  return (tuning.pitchMin + Math.random() * (tuning.pitchMax - tuning.pitchMin)) * safePitchScale;
}

function clampPitchScale(value) {
  return Number.isFinite(value) ? Math.max(0.72, Math.min(1.32, value)) : 1;
}

function getFallbackTone(role) {
  switch (role) {
    case "levelUp":
      return { type: "triangle", startHz: 520, endHz: 980, seconds: 0.28, gain: 0.12 };
    case "death":
    case "destroyTank":
      return { type: "sawtooth", startHz: 180, endHz: 70, seconds: 0.35, gain: 0.14 };
    case "alphaDestroy":
      return { type: "sawtooth", startHz: 120, endHz: 55, seconds: 0.55, gain: 0.16 };
    case "fire":
      return { type: "square", startHz: 920, endHz: 360, seconds: 0.08, gain: 0.08 };
    case "uiClick":
      return { type: "triangle", startHz: 840, endHz: 1080, seconds: 0.05, gain: 0.06 };
    default:
      return { type: "triangle", startHz: 560, endHz: 300, seconds: 0.1, gain: 0.08 };
  }
}
