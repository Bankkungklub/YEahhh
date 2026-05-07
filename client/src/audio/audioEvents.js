import { AUDIO_CONFIG, getSfxBucket } from "./audioConfig.js";

export function deriveAudioEvents({
  previousSnapshot,
  nextSnapshot,
  playerId,
  visualEffects = [],
  deathMessage = null,
  nowMs = 0,
  config = AUDIO_CONFIG
} = {}) {
  const events = [];
  const append = (event) => {
    if (!event?.role) {
      return;
    }
    events.push({
      id: `${event.role}-${Math.round(nowMs)}-${events.length}`,
      bucket: getSfxBucket(event.role, config),
      priority: config.sfxRules.priority[event.role] ?? 1,
      gain: 1,
      local: false,
      nowMs,
      ...event
    });
  };

  if (deathMessage) {
    append({
      role: "death",
      local: true,
      gain: getRoleGain(config, "localDeath", 1),
      importance: "critical"
    });
    return events;
  }

  if (!previousSnapshot || !nextSnapshot || !playerId) {
    return events;
  }

  const localTank = getLocalTank(nextSnapshot, playerId);
  appendProjectileFireEvents({ append, previousSnapshot, nextSnapshot, playerId, localTank, config });
  appendEventObjectiveSpawnEvents({ append, previousSnapshot, nextSnapshot, localTank, config });
  appendVisualEffectEvents({ append, visualEffects, localTank, config });
  appendDestroyedTargetEvents({ append, previousSnapshot, nextSnapshot, playerId, localTank, config });

  return events;
}

function appendEventObjectiveSpawnEvents({ append, previousSnapshot, nextSnapshot, localTank, config }) {
  const previousIds = new Set((previousSnapshot.eventObjectives ?? []).map((event) => event.id));
  for (const eventObjective of nextSnapshot.eventObjectives ?? []) {
    if (previousIds.has(eventObjective.id)) {
      continue;
    }
    append({
      role: "eventObjective",
      local: false,
      x: eventObjective.x,
      y: eventObjective.y,
      gain: Math.max(getRoleGain(config, "eventObjectiveMin", 0.28), getDistanceGain(eventObjective, localTank, config)),
      importance: eventObjective.threatLevel >= 3 ? "high" : "normal",
      eventType: eventObjective.typeId
    });
  }
}

export function createAudioEventLimiter(config = AUDIO_CONFIG) {
  const recentByBucket = new Map();
  const lastByProfile = new Map();
  const stats = [];

  function accept(event, nowMs = performance.now()) {
    const bucket = event.bucket ?? getSfxBucket(event.role, config);
    const profileKey = event.role === "fire" && event.feedbackProfile
      ? `${event.role}:${event.feedbackProfile}`
      : null;
    if (profileKey) {
      const cooldownMs = getAudioProfileForFireEvent(event, config).cooldownMs;
      const lastAt = lastByProfile.get(profileKey) ?? -Infinity;
      if (nowMs - lastAt < cooldownMs) {
        return false;
      }
    }
    const limit = config.sfxRules.maxPerSecond[bucket] ?? 12;
    const recent = (recentByBucket.get(bucket) ?? []).filter((time) => nowMs - time < 1000);
    if (recent.length >= limit) {
      recentByBucket.set(bucket, recent);
      return false;
    }
    recent.push(nowMs);
    recentByBucket.set(bucket, recent);
    if (profileKey) {
      lastByProfile.set(profileKey, nowMs);
    }
    stats.push({ role: event.role, bucket, time: nowMs });
    pruneStats(stats, nowMs, config);
    return true;
  }

  function getStats(nowMs = performance.now()) {
    pruneStats(stats, nowMs, config);
    const counts = {};
    for (const event of stats) {
      counts[event.role] = (counts[event.role] ?? 0) + 1;
    }
    return counts;
  }

  return { accept, getStats };
}

export function getDistanceGain(event, localTank, config = AUDIO_CONFIG) {
  if (!config.sfxRules.distance.enabled || event.local || config.sfxRules.distance.localEventsFullVolume && event.local) {
    return 1;
  }
  if (!localTank || !Number.isFinite(event.x) || !Number.isFinite(event.y)) {
    return 1;
  }
  const distance = Math.hypot(event.x - localTank.x, event.y - localTank.y);
  const ratio = Math.max(0, Math.min(1, 1 - distance / config.sfxRules.distance.maxDistance));
  return ratio ** config.sfxRules.distance.curvePower;
}

function appendProjectileFireEvents({ append, previousSnapshot, nextSnapshot, playerId, localTank, config }) {
  const previousProjectileIds = new Set((previousSnapshot.projectiles ?? []).map((projectile) => projectile.id));
  const newLocalProjectiles = (nextSnapshot.projectiles ?? [])
    .filter((projectile) => projectile.ownerId === playerId && !previousProjectileIds.has(projectile.id));
  if (newLocalProjectiles.length === 0) {
    return;
  }
  const first = newLocalProjectiles[0];
  const profile = getMostCommonFeedbackProfile(newLocalProjectiles);
  const profileTuning = getAudioProfileForFireEvent({ feedbackProfile: profile }, config);
  append({
    role: "fire",
    local: true,
    x: first.x ?? localTank?.x,
    y: first.y ?? localTank?.y,
    count: newLocalProjectiles.length,
    feedbackProfile: profile,
    gain: profileTuning.gainMultiplier,
    pitchScale: profileTuning.pitchMultiplier,
    profileCooldownMs: profileTuning.cooldownMs
  });
}

export function getAudioProfileForFireEvent(event, config = AUDIO_CONFIG) {
  const profile = event?.feedbackProfile ?? "standard";
  return config.sfxRules?.feedbackProfiles?.[profile]
    ?? config.sfxRules?.feedbackProfiles?.standard
    ?? { gainMultiplier: 1, pitchMultiplier: 1, cooldownMs: 70 };
}

function getMostCommonFeedbackProfile(projectiles) {
  const counts = new Map();
  for (const projectile of projectiles) {
    const profile = projectile.feedbackProfile ?? projectile.behavior ?? projectile.kind ?? "standard";
    counts.set(profile, (counts.get(profile) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "standard";
}

function appendVisualEffectEvents({ append, visualEffects, localTank, config }) {
  for (const effect of visualEffects) {
    if (effect.type === "damageText") {
      append({
        role: effect.targetType === "tank" ? "hitTank" : "hitShape",
        local: Boolean(effect.isLocal),
        x: effect.x,
        y: effect.y,
        gain: getDistanceGain(effect, localTank, config)
      });
    }
    if (effect.type === "levelToast") {
      append({
        role: "levelUp",
        local: true,
        gain: getRoleGain(config, "localLevelUp", 1),
        importance: "critical"
      });
    }
    if (effect.type === "upgradeReady") {
      append({
        role: "upgradeReady",
        local: true,
        gain: getRoleGain(config, "localUpgradeReady", 0.85),
        importance: "high"
      });
    }
  }
}

function appendDestroyedTargetEvents({ append, previousSnapshot, nextSnapshot, playerId, localTank, config }) {
  const nextShapes = new Set((nextSnapshot.shapes ?? []).map((shape) => shape.id));
  for (const shape of previousSnapshot.shapes ?? []) {
    if (nextShapes.has(shape.id)) {
      continue;
    }
    const isAlpha = shape.isCenterObjective || shape.shapeType === "alphaPentagon";
    const isEventObjective = Boolean(shape.isEventObjective);
    append({
      role: isAlpha ? "alphaDestroy" : isEventObjective ? "eventObjective" : "destroyShape",
      local: false,
      x: shape.x,
      y: shape.y,
      gain: isAlpha
        ? Math.max(getRoleGain(config, "alphaDestroyMin", 0.35), getDistanceGain(shape, localTank, config))
        : isEventObjective
          ? Math.max(getRoleGain(config, "eventObjectiveMin", 0.28), getDistanceGain(shape, localTank, config))
        : getNearbyGain(shape, localTank),
      importance: isAlpha ? "critical" : isEventObjective ? "high" : "normal"
    });
  }

  const nextDrones = new Set((nextSnapshot.drones ?? []).map((drone) => drone.id));
  for (const drone of previousSnapshot.drones ?? []) {
    if (nextDrones.has(drone.id)) {
      continue;
    }
    append({
      role: "destroyShape",
      local: drone.ownerId === playerId,
      x: drone.x,
      y: drone.y,
      gain: getNearbyGain(drone, localTank),
      importance: "low"
    });
  }

  const nextTanks = new Map((nextSnapshot.tanks ?? []).map((tank) => [tank.id, tank]));
  for (const tank of previousSnapshot.tanks ?? []) {
    const nextTank = nextTanks.get(tank.id);
    if (!nextTank || tank.state !== "alive" || nextTank.state !== "dead") {
      continue;
    }
    append({
      role: tank.id === playerId ? "death" : "destroyTank",
      local: tank.id === playerId,
      x: tank.x,
      y: tank.y,
      gain: tank.id === playerId ? getRoleGain(config, "localDeath", 1) : getNearbyGain(tank, localTank),
      importance: tank.id === playerId ? "critical" : "high"
    });
  }
}

function getNearbyGain(entity, localTank) {
  if (!localTank) {
    return 1;
  }
  const distance = Math.hypot((entity.x ?? 0) - localTank.x, (entity.y ?? 0) - localTank.y);
  return distance <= AUDIO_CONFIG.sfxRules.distance.maxDistance ? 1 : 0;
}

function getRoleGain(config, key, fallback) {
  const value = config.sfxRules?.roleGain?.[key];
  return Number.isFinite(value) ? value : fallback;
}

function getLocalTank(snapshot, playerId) {
  return (snapshot?.tanks ?? []).find((tank) => tank.id === playerId) ?? null;
}

function pruneStats(stats, nowMs, config) {
  const windowMs = config.debug.eventStatsWindowMs;
  while (stats.length && nowMs - stats[0].time > windowMs) {
    stats.shift();
  }
}
