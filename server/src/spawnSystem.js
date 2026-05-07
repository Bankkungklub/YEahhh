import { GAME_CONFIG } from "../../shared/config/gameConfig.js";
import { WORLD_CONTENT_CONFIG } from "../../shared/config/worldContentConfig.js";
import { getCenterBlockedZones, isInsideBlockedZone } from "../../shared/sim/centerObjective.js";
import { wouldOverlapAny } from "../../shared/sim/collision.js";
import { distanceSq, randomPointInWorld } from "../../shared/sim/vector.js";

export function findSafeSpawn({
  state,
  radius,
  rng = Math.random,
  safetyRadius = GAME_CONFIG.world.spawnSafetyRadius,
  tankSafetyRadius = safetyRadius,
  shapeSafetyRadius = safetyRadius,
  attempts = GAME_CONFIG.shapes.spawnAttempts,
  config = GAME_CONFIG,
  blockedZones = getCenterBlockedZones(config)
}) {
  const blockers = getSpawnBlockers(state);

  for (let i = 0; i < attempts; i += 1) {
    const point = randomPointInWorld(rng, config.world, radius);
    const candidate = { ...point, radius };
    if (
      !isInsideBlockedZone(candidate, blockedZones) &&
      isSpawnSafe(candidate, blockers, tankSafetyRadius, shapeSafetyRadius)
    ) {
      return point;
    }
  }

  return findFallbackCorner(blockers, radius, config, blockedZones);
}

export function chooseShapeType(rng = Math.random, config = GAME_CONFIG) {
  const entries = Object.entries(config.shapes.types)
    .filter(([, shape]) => shape.spawnable !== false && shape.weight > 0);
  const totalWeight = entries.reduce((sum, [, shape]) => sum + shape.weight, 0);
  let roll = rng() * totalWeight;

  for (const [shapeType, shape] of entries) {
    roll -= shape.weight;
    if (roll <= 0) {
      return shapeType;
    }
  }

  return entries[entries.length - 1][0];
}

export function getNormalShapeBlockedZones(config = GAME_CONFIG) {
  return getCenterBlockedZones(
    config,
    WORLD_CONTENT_CONFIG.centerObjective.normalShapeExclusionRadius
  );
}

function getSpawnBlockers(state) {
  return [
    ...state.tanks.values(),
    ...state.shapes.values()
  ].filter((entity) => entity.state === "alive");
}

function isSpawnSafe(candidate, blockers, tankSafetyRadius, shapeSafetyRadius) {
  const tanks = blockers.filter((blocker) => blocker.type === "tank");
  const shapes = blockers.filter((blocker) => blocker.type === "shape");
  return (
    !wouldOverlapAny(candidate, tanks, tankSafetyRadius) &&
    !wouldOverlapAny(candidate, shapes, shapeSafetyRadius)
  );
}

function findFallbackCorner(blockers, radius, config, blockedZones = []) {
  const margin = Math.max(radius, 80);
  const candidates = [
    { x: margin, y: margin },
    { x: config.world.width - margin, y: margin },
    { x: margin, y: config.world.height - margin },
    { x: config.world.width - margin, y: config.world.height - margin },
    { x: config.world.width / 2, y: config.world.height / 2 }
  ];

  let best = candidates[0];
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    if (isInsideBlockedZone({ ...candidate, radius }, blockedZones)) {
      continue;
    }
    let nearest = Infinity;
    for (const blocker of blockers) {
      nearest = Math.min(nearest, distanceSq(candidate, blocker));
    }
    if (nearest > bestScore) {
      best = candidate;
      bestScore = nearest;
    }
  }

  return best;
}
