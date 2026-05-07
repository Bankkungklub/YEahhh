export const REQUIRED_SFX_ROLES = Object.freeze([
  "fire",
  "hitShape",
  "hitTank",
  "destroyShape",
  "destroyTank",
  "levelUp",
  "upgradeReady",
  "death",
  "uiClick",
  "alphaDestroy",
  "eventObjective"
]);

export const AUDIO_CONFIG = Object.freeze({
  assets: {
    music: {
      chillArcade: {
        path: "/assets/audio/music/chill_arcade_loop.mp3",
        loop: true,
        source: "OpenGameArt Chill (Loopable)",
        sourceUrl: "https://opengameart.org/content/chill-loopable",
        license: "CC0"
      }
    },
    sfx: {
      fire: "/assets/audio/sfx/fire_laser.wav",
      hitShape: "/assets/audio/sfx/hit_shape.wav",
      hitTank: "/assets/audio/sfx/hit_tank.wav",
      destroyShape: "/assets/audio/sfx/destroy_shape.wav",
      destroyTank: "/assets/audio/sfx/destroy_tank.wav",
      levelUp: "/assets/audio/sfx/level_up.wav",
      upgradeReady: "/assets/audio/sfx/upgrade_ready.wav",
      death: "/assets/audio/sfx/death.wav",
      uiClick: "/assets/audio/sfx/ui_click.wav",
      alphaDestroy: "/assets/audio/sfx/alpha_destroy.wav",
      eventObjective: "/assets/audio/sfx/alpha_destroy.wav"
    }
  },
  engine: {
    enabled: true,
    masterDefault: 0.85,
    musicDefault: 0.28,
    sfxDefault: 0.75,
    maxSimultaneousSfx: 18
  },
  settings: {
    storageKey: "tankArena.audio.v1",
    sliderStep: 0.01,
    minVolume: 0,
    maxVolume: 1
  },
  music: {
    defaultTrack: "chillArcade",
    fadeInMs: 1200,
    fadeOutMs: 600,
    menuVolumeScale: 0.85,
    playingVolumeScale: 1,
    deadVolumeScale: 0.65
  },
  sfxRules: {
    maxPerSecond: {
      fire: 10,
      hit: 12,
      destroy: 7,
      ui: 8,
      level: 3
    },
    priority: {
      alphaDestroy: 120,
      levelUp: 112,
      death: 108,
      eventObjective: 88,
      destroyTank: 82,
      upgradeReady: 76,
      destroyShape: 54,
      hitTank: 44,
      hitShape: 28,
      fire: 18,
      uiClick: 8
    },
    roleGain: {
      localDeath: 1,
      localLevelUp: 1,
      localUpgradeReady: 0.92,
      alphaDestroyMin: 0.42,
      eventObjectiveMin: 0.28
    },
    feedbackProfiles: {
      standard: { gainMultiplier: 1, pitchMultiplier: 1, cooldownMs: 70 },
      rapid: { gainMultiplier: 0.72, pitchMultiplier: 1.13, cooldownMs: 95 },
      precision: { gainMultiplier: 0.95, pitchMultiplier: 1.02, cooldownMs: 100 },
      spread: { gainMultiplier: 0.82, pitchMultiplier: 1.06, cooldownMs: 95 },
      storm: { gainMultiplier: 0.62, pitchMultiplier: 1.18, cooldownMs: 145 },
      heavy: { gainMultiplier: 1.22, pitchMultiplier: 0.78, cooldownMs: 185 },
      rocket: { gainMultiplier: 1.08, pitchMultiplier: 0.88, cooldownMs: 150 },
      missile: { gainMultiplier: 1.16, pitchMultiplier: 0.84, cooldownMs: 170 },
      trap: { gainMultiplier: 0.76, pitchMultiplier: 0.94, cooldownMs: 130 },
      drone: { gainMultiplier: 0.58, pitchMultiplier: 1.08, cooldownMs: 180 },
      booster: { gainMultiplier: 0.78, pitchMultiplier: 1.16, cooldownMs: 105 },
      body: { gainMultiplier: 0.7, pitchMultiplier: 0.92, cooldownMs: 130 }
    },
    distance: {
      enabled: true,
      maxDistance: 1800,
      curvePower: 1.6,
      localEventsFullVolume: true
    }
  },
  sfx: {
    fire: { gain: 0.28, pitchMin: 0.96, pitchMax: 1.04, bucket: "fire" },
    hitShape: { gain: 0.34, pitchMin: 0.9, pitchMax: 1.08, bucket: "hit" },
    hitTank: { gain: 0.46, pitchMin: 0.92, pitchMax: 1.05, bucket: "hit" },
    destroyShape: { gain: 0.5, pitchMin: 0.9, pitchMax: 1, bucket: "destroy" },
    destroyTank: { gain: 0.74, pitchMin: 0.9, pitchMax: 1, bucket: "destroy" },
    levelUp: { gain: 0.82, pitchMin: 1, pitchMax: 1, bucket: "level" },
    upgradeReady: { gain: 0.55, pitchMin: 1, pitchMax: 1, bucket: "level" },
    death: { gain: 0.82, pitchMin: 0.95, pitchMax: 1, bucket: "destroy" },
    uiClick: { gain: 0.24, pitchMin: 0.98, pitchMax: 1.04, bucket: "ui" },
    alphaDestroy: { gain: 0.92, pitchMin: 0.95, pitchMax: 1, bucket: "destroy" },
    eventObjective: { gain: 0.68, pitchMin: 1.02, pitchMax: 1.08, bucket: "destroy" }
  },
  debug: {
    includeInF3: true,
    eventStatsWindowMs: 1000
  }
});

export function validateAudioConfig(config = AUDIO_CONFIG) {
  const issues = [];
  if (!config?.engine?.enabled) {
    issues.push("Audio engine is disabled.");
  }
  for (const role of REQUIRED_SFX_ROLES) {
    if (typeof config.assets?.sfx?.[role] !== "string" || config.assets.sfx[role].length === 0) {
      issues.push(`Missing SFX asset for ${role}.`);
    }
    const sfx = config.sfx?.[role];
    if (!sfx) {
      issues.push(`Missing SFX tuning for ${role}.`);
      continue;
    }
    if (!isUnitish(sfx.gain)) {
      issues.push(`Invalid gain for ${role}.`);
    }
    if (!Number.isFinite(sfx.pitchMin) || !Number.isFinite(sfx.pitchMax) || sfx.pitchMin <= 0 || sfx.pitchMax < sfx.pitchMin) {
      issues.push(`Invalid pitch range for ${role}.`);
    }
  }
  for (const [bucket, limit] of Object.entries(config.sfxRules?.maxPerSecond ?? {})) {
    if (!Number.isFinite(limit) || limit <= 0) {
      issues.push(`Invalid max-per-second value for ${bucket}.`);
    }
  }
  for (const [key, gain] of Object.entries(config.sfxRules?.roleGain ?? {})) {
    if (!isUnitish(gain)) {
      issues.push(`Invalid role gain ${key}.`);
    }
  }
  for (const [profile, tuning] of Object.entries(config.sfxRules?.feedbackProfiles ?? {})) {
    if (!Number.isFinite(tuning.gainMultiplier) || tuning.gainMultiplier < 0.55 || tuning.gainMultiplier > 1.25) {
      issues.push(`Invalid feedback profile gain ${profile}.`);
    }
    if (!Number.isFinite(tuning.pitchMultiplier) || tuning.pitchMultiplier < 0.72 || tuning.pitchMultiplier > 1.32) {
      issues.push(`Invalid feedback profile pitch ${profile}.`);
    }
    if (!Number.isFinite(tuning.cooldownMs) || tuning.cooldownMs < 0 || tuning.cooldownMs > 400) {
      issues.push(`Invalid feedback profile cooldown ${profile}.`);
    }
  }
  if ((config.sfxRules?.priority?.alphaDestroy ?? 0) <= (config.sfxRules?.priority?.fire ?? 0)) {
    issues.push("alphaDestroy priority must exceed fire priority.");
  }
  if ((config.sfxRules?.priority?.eventObjective ?? 0) <= (config.sfxRules?.priority?.destroyShape ?? 0)) {
    issues.push("eventObjective priority must exceed destroyShape priority.");
  }
  if ((config.sfxRules?.priority?.death ?? 0) <= (config.sfxRules?.priority?.hitShape ?? 0)) {
    issues.push("death priority must exceed hitShape priority.");
  }
  for (const key of ["masterDefault", "musicDefault", "sfxDefault"]) {
    if (!isUnitish(config.engine?.[key])) {
      issues.push(`Invalid engine default ${key}.`);
    }
  }
  return issues;
}

export function getSfxBucket(role, config = AUDIO_CONFIG) {
  return config.sfx?.[role]?.bucket ?? role;
}

function isUnitish(value) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}
