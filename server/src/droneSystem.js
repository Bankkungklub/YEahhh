import { DRONE_CONFIG, getDroneLoadout } from "../../shared/config/droneConfig.js";
import { GAME_CONFIG, getTankStats } from "../../shared/config/gameConfig.js";
import {
  applyDroneDamage,
  buildDroneCommand,
  canConvertShapeToDrone,
  createDrone,
  expireOwnerDrones,
  getDroneSnapshot,
  getOwnerDroneCounts,
  recordDroneTargetHit,
  shouldDroneHitTarget,
  updateDroneMotion
} from "../../shared/sim/drones.js";
import { getFirstCircleHit } from "../../shared/sim/collision.js";
import { getClassAdjustedTankStats, getDroneLoadoutId } from "../../shared/sim/tankClasses.js";
import { canProjectileHitTarget } from "../../shared/sim/projectileBehaviors.js";

export function ensureDroneState(game) {
  if (!game.drones) {
    game.drones = new Map();
  }
  return game.drones;
}

export function maintainDrones(game, dtSeconds, dtMs) {
  const drones = ensureDroneState(game);
  cleanupInvalidDrones(game);
  rebuildMissingBaseDrones(game);
  for (const drone of drones.values()) {
    if (drone.state !== "active") {
      continue;
    }
    const owner = game.tanks.get(drone.ownerId);
    const loadout = getDroneLoadout(drone.loadoutId);
    if (!owner || !loadout) {
      drone.state = "expired";
      continue;
    }
    const command = buildDroneCommand(owner, loadout);
    updateDroneMotion({
      drone,
      owner,
      loadout,
      command,
      dtSeconds,
      nowMs: game.timeMs,
      world: game.config.world
    });
  }
}

export function cleanupOwnerDrones(game, ownerId) {
  return expireOwnerDrones(ensureDroneState(game), ownerId);
}

export function cleanupInvalidDrones(game) {
  const drones = ensureDroneState(game);
  for (const [id, drone] of drones) {
    const owner = game.tanks.get(drone.ownerId);
    if (drone.state !== "active" || !owner || owner.state !== "alive" || owner.disconnectedAtMs != null || getDroneLoadoutId(owner.classId) !== drone.loadoutId) {
      drones.delete(id);
    }
  }
}

export function getProjectileDroneHit(game, projectile) {
  if (!projectile || projectile.state !== "active") {
    return null;
  }
  const candidates = [...ensureDroneState(game).values()]
    .filter((drone) => {
      if (drone.state !== "active" || drone.ownerId === projectile.ownerId) {
        return false;
      }
      return canProjectileHitTarget(projectile, drone.id, game.timeMs);
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  return getFirstCircleHit(projectile, candidates);
}

export function damageDroneWithProjectile(game, drone, projectile) {
  if (!drone || drone.state !== "active" || !projectile) {
    return 0;
  }
  const damage = Math.max(0, Number(projectile.damage) || 0) * DRONE_CONFIG.projectileVsDroneMultiplier;
  const applied = applyDroneDamage(drone, damage);
  if (applied > 0) {
    drone.lastDamagedAtMs = game.timeMs;
    drone.lastDamagedById = projectile.ownerId ?? null;
  }
  if (drone.state !== "active") {
    drone.destroyedAtMs = game.timeMs;
  }
  return applied;
}

export function resolveDroneContactDamage(game, dtSeconds) {
  const drones = [...ensureDroneState(game).values()]
    .filter((drone) => drone.state === "active")
    .sort((a, b) => a.id.localeCompare(b.id));
  let pairs = 0;
  for (const drone of drones) {
    if (pairs >= DRONE_CONFIG.maxContactPairsPerTick) {
      break;
    }
    const owner = game.tanks.get(drone.ownerId);
    if (!owner || owner.state !== "alive") {
      drone.state = "expired";
      continue;
    }
    const loadout = getDroneLoadout(drone.loadoutId);
    const candidates = game.spatialIndex?.queryCircle
      ? game.spatialIndex.queryCircle(drone.x, drone.y, drone.radius + game.maxCollisionCandidateRadius + 24)
      : [...game.shapes.values(), ...game.tanks.values()];
    for (const candidate of candidates) {
      if (pairs >= DRONE_CONFIG.maxContactPairsPerTick || candidate.state !== "alive") {
        break;
      }
      if (candidate.type === "tank") {
        if (candidate.id === owner.id || game.isTankInvulnerable(candidate)) {
          continue;
        }
        if (circlesOverlap(drone, candidate) && shouldDroneHitTarget(drone, candidate, game.timeMs)) {
          recordDroneTargetHit(drone, candidate.id, game.timeMs);
          game.damageTank(candidate, createDroneDamageSource({ drone, owner, target: candidate, damage: getDroneDamage(game, owner, loadout), nowMs: game.timeMs }));
          pairs += 1;
        }
        continue;
      }
      if (candidate.type === "shape" && circlesOverlap(drone, candidate) && shouldDroneHitTarget(drone, candidate, game.timeMs)) {
        recordDroneTargetHit(drone, candidate.id, game.timeMs);
        game.damageShape(candidate, createDroneDamageSource({ drone, owner, target: candidate, damage: getDroneDamage(game, owner, loadout), nowMs: game.timeMs }));
        pairs += 1;
      }
    }
  }
  if (game.performanceStats?.droneContact) {
    game.performanceStats.droneContact.pairs += pairs;
  }
  return pairs;
}

export function handleNecromancerShapeConversion(game, shape, source) {
  const owner = game.tanks.get(source?.ownerId);
  const loadoutId = owner ? getDroneLoadoutId(owner.classId) : null;
  const loadout = loadoutId ? getDroneLoadout(loadoutId) : null;
  if (!owner || !loadout || Object.keys(loadout.conversionRules ?? {}).length === 0) {
    return 0;
  }
  const counts = getOwnerDroneCounts(ensureDroneState(game), owner.id, loadout);
  const available = Math.max(0, loadout.maxDrones - counts.current);
  if (available <= 0) {
    return 0;
  }
  const roll = canConvertShapeToDrone({ tank: owner, shape, loadout, rng: game.rng });
  if (!roll.converted) {
    return 0;
  }
  let spawned = 0;
  for (let index = 0; index < Math.min(available, roll.count); index += 1) {
    if (!ensureDroneBudget(game, owner)) {
      break;
    }
    spawnDroneForOwner(game, owner, loadout, {
      converted: true,
      slotIndex: counts.current + index,
      ttlMs: loadout.convertedDroneTtlMs
    });
    spawned += 1;
  }
  return spawned;
}

export function getDroneSnapshots(game) {
  return [...ensureDroneState(game).values()]
    .filter((drone) => drone.state === "active")
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((drone) => getDroneSnapshot(drone));
}

export function getDroneDebug(game) {
  const active = [...ensureDroneState(game).values()].filter((drone) => drone.state === "active");
  const byLoadout = {};
  const modes = {};
  const byOwner = {};
  for (const drone of active) {
    byLoadout[drone.loadoutId] = (byLoadout[drone.loadoutId] ?? 0) + 1;
    modes[drone.mode] = (modes[drone.mode] ?? 0) + 1;
    byOwner[drone.ownerId] = (byOwner[drone.ownerId] ?? 0) + 1;
  }
  return {
    totalActive: active.length,
    globalCap: DRONE_CONFIG.globalDroneCap,
    capRemaining: Math.max(0, DRONE_CONFIG.globalDroneCap - active.length),
    byLoadout,
    modes,
    ownerCount: Object.keys(byOwner).length
  };
}

export function getLocalDroneStatus(game, tank) {
  const loadoutId = tank ? getDroneLoadoutId(tank.classId) : null;
  const loadout = loadoutId ? getDroneLoadout(loadoutId) : null;
  if (!tank || !loadout) {
    return null;
  }
  const counts = getOwnerDroneCounts(ensureDroneState(game), tank.id, loadout);
  return {
    label: loadout.label,
    current: counts.current,
    converted: counts.converted,
    base: counts.base,
    baseCap: loadout.baseDrones,
    max: loadout.maxDrones,
    loadoutId
  };
}

function rebuildMissingBaseDrones(game) {
  const drones = ensureDroneState(game);
  const owners = [...game.tanks.values()]
    .filter((tank) => tank.state === "alive" && getDroneLoadoutId(tank.classId))
    .sort((a, b) => (a.kind === "player" ? -1 : 1) - (b.kind === "player" ? -1 : 1) || a.id.localeCompare(b.id));
  for (const owner of owners) {
    const loadout = getDroneLoadout(getDroneLoadoutId(owner.classId));
    const counts = getOwnerDroneCounts(drones, owner.id, loadout);
    if (counts.base >= loadout.baseDrones) {
      continue;
    }
    owner.nextDroneRebuildAtMs ??= game.timeMs;
    if (game.timeMs < owner.nextDroneRebuildAtMs) {
      continue;
    }
    if (!ensureDroneBudget(game, owner)) {
      owner.nextDroneRebuildAtMs = game.timeMs + 250;
      continue;
    }
    const slotIndex = getFirstOpenBaseSlot(drones, owner.id, loadout);
    spawnDroneForOwner(game, owner, loadout, { slotIndex });
    owner.nextDroneRebuildAtMs = game.timeMs + getEffectiveRebuildMs(game, owner, loadout);
  }
}

function spawnDroneForOwner(game, owner, loadout, { converted = false, slotIndex = 0, ttlMs = null } = {}) {
  const drone = createDrone({
    id: game.nextEntityId(converted ? "swarm" : "drone"),
    owner,
    loadout,
    slotIndex,
    nowMs: game.timeMs,
    converted,
    ttlMs
  });
  game.drones.set(drone.id, drone);
  return drone;
}

function ensureDroneBudget(game, owner) {
  const drones = ensureDroneState(game);
  if (drones.size < DRONE_CONFIG.globalDroneCap) {
    return true;
  }
  if (owner.kind !== "player") {
    return false;
  }
  const botDrone = [...drones.values()].find((drone) => {
    const droneOwner = game.tanks.get(drone.ownerId);
    return drone.state === "active" && droneOwner?.kind === "bot";
  });
  if (!botDrone) {
    return false;
  }
  botDrone.state = "expired";
  drones.delete(botDrone.id);
  return true;
}

function getFirstOpenBaseSlot(drones, ownerId, loadout) {
  const occupied = new Set(
    [...drones.values()]
      .filter((drone) => drone.ownerId === ownerId && drone.state === "active" && !drone.converted)
      .map((drone) => drone.slotIndex)
  );
  for (let index = 0; index < loadout.baseDrones; index += 1) {
    if (!occupied.has(index)) {
      return index;
    }
  }
  return 0;
}

function createDroneDamageSource({ drone, owner, target, damage, nowMs }) {
  return {
    id: `drone-contact-${drone.id}-${target.id}`,
    type: "drone",
    kind: "drone",
    behavior: "drone",
    damageCause: "drone",
    ownerId: owner.id,
    ownerName: owner.name,
    ownerKind: owner.kind,
    x: drone.x,
    y: drone.y,
    prevX: drone.prevX ?? drone.x,
    prevY: drone.prevY ?? drone.y,
    radius: drone.radius,
    damage,
    ageMs: 0,
    ttlMs: 0,
    createdAtMs: nowMs,
    state: "active"
  };
}

function getDroneDamage(game, owner, loadout) {
  const stats = getClassAdjustedTankStats(getTankStats(owner.upgrades, game.config), owner.classId);
  const baseDamage = GAME_CONFIG.projectile.baseDamage;
  const damageMultiplier = Math.max(0.25, (stats.bulletDamage ?? baseDamage) / baseDamage);
  return loadout.bodyDamage * damageMultiplier;
}

function getEffectiveRebuildMs(game, owner, loadout) {
  const stats = getClassAdjustedTankStats(getTankStats(owner.upgrades, game.config), owner.classId);
  const baseReload = game.config.projectile.baseReloadMs;
  const reloadMultiplier = Math.max(0.75, Math.min(1.35, baseReload / Math.max(1, stats.reloadMs)));
  return Math.max(120, loadout.rebuildMs / reloadMultiplier);
}

function circlesOverlap(a, b) {
  const radius = (Number(a.radius) || 0) + (Number(b.radius) || 0);
  const dx = (Number(a.x) || 0) - (Number(b.x) || 0);
  const dy = (Number(a.y) || 0) - (Number(b.y) || 0);
  return dx * dx + dy * dy <= radius * radius;
}
