import { GAME_CONFIG, UPGRADE_KEYS } from "../../shared/config/gameConfig.js";
import { getTankStats } from "../../shared/config/gameConfig.js";
import { EVENT_OBJECTIVE_CONFIG } from "../../shared/config/eventObjectiveConfig.js";
import { getCenterObjectiveBotTargetWeight, isCenterObjectiveShape } from "../../shared/sim/centerObjective.js";
import { createTank, refreshTankStats } from "../../shared/sim/entityFactory.js";
import { applyProfileToBot, chooseBotProfile, getBotProfile, getBotProfileDebugCounts } from "../../shared/sim/botProfiles.js";
import { clearBotRivalState, createBotRivalState, ensureBotRivalState, getBotRivalTargetScoreBonus, recordBotRivalDamageMemory } from "../../shared/sim/botRivals.js";
import { addXp, applyUpgrade, createProgression } from "../../shared/sim/progression.js";
import { getAvailableClassChoices, getClassAdjustedTankStats, selectTankClass } from "../../shared/sim/tankClasses.js";
import { distanceSq, normalize } from "../../shared/sim/vector.js";
import { cleanupOwnerDrones } from "./droneSystem.js";
import { findSafeSpawn } from "./spawnSystem.js";

const FALLBACK_UPGRADE_PRIORITY = [
  "bulletDamage",
  "reload",
  "moveSpeed",
  "maxHealth",
  "regen",
  "bulletSpeed"
];

export function maintainBotPopulation(game) {
  const humans = [...game.tanks.values()].filter((tank) => tank.kind === "player").length;
  const liveBots = [...game.tanks.values()].filter((tank) => tank.kind === "bot").length;
  const target = Math.min(
    game.config.bots.maxCount,
    game.config.bots.baseCount + Math.floor(humans * game.config.bots.perHuman)
  );

  for (let i = liveBots; i < target; i += 1) {
    spawnBot(game);
  }
}

export function updateBots(game) {
  for (const bot of game.tanks.values()) {
    if (bot.kind !== "bot") {
      continue;
    }

    const profile = ensureBotGovernanceFields(bot, game.timeMs);

    if (bot.state === "dead" && game.timeMs >= bot.respawnAtMs) {
      game.respawnTank(bot);
      continue;
    }

    if (bot.state !== "alive") {
      continue;
    }

    const recycled = applyBotGovernance(game, bot);
    if (recycled) {
      continue;
    }

    autoSelectBotClass(bot, game.config, profile);
    autoSpendBotUpgrades(bot, game.config, profile);

    if (game.timeMs < bot.ai.reactionAtMs) {
      continue;
    }
    bot.ai.reactionAtMs = game.timeMs + profile.reactionMs;
    updateBotIntent(game, bot, game.spatialIndex);
  }
}

export function updateBotIntent(game, bot, spatialIndex = null) {
  const profile = ensureBotGovernanceFields(bot, game.timeMs);
  pruneBotMemory(bot, game.timeMs);
  const enemy = findBestEnemy(game, bot, profile, spatialIndex);
  const shape = findBestShape(game, bot, profile, spatialIndex);
  const drone = findBestDrone(game, bot, profile);
  const hpRatio = bot.hp / bot.maxHp;
  const target = chooseBotGoal(game, bot, enemy, shape, profile, drone);

  if (enemy && (hpRatio <= profile.retreatHpRatio || game.timeMs < bot.ai.panicUntilMs)) {
    setRetreatIntent(game, bot, enemy, profile);
    applyBotMistake(game, bot, profile);
    return;
  }

  if (target?.type === "tank") {
    setCombatIntent(game, bot, target.entity, profile);
    applyBotMistake(game, bot, profile);
    return;
  }

  if (target?.type === "drone") {
    setDroneCombatIntent(game, bot, target.entity, profile);
    applyBotMistake(game, bot, profile);
    return;
  }

  if (target?.type === "shape") {
    setFarmIntent(game, bot, target.entity, profile);
    applyBotMistake(game, bot, profile);
    return;
  }

  setWanderIntent(game, bot, profile);
  applyBotMistake(game, bot, profile);
}

export function getBotProfileCounts(game) {
  return getBotProfileDebugCounts(game.tanks.values());
}

export function getBotClassDebugCounts(game) {
  const counts = {};
  for (const tank of game.tanks.values()) {
    if (tank.kind !== "bot") {
      continue;
    }
    const classId = tank.classId ?? "basic";
    counts[classId] = (counts[classId] ?? 0) + 1;
  }
  return counts;
}

export function getBotBehaviorDebugCounts(game) {
  const modes = {};
  const targetKinds = {};
  let panic = 0;
  let revenge = 0;
  for (const tank of game.tanks.values()) {
    if (tank.kind !== "bot") {
      continue;
    }
    const mode = tank.ai?.mode ?? "unknown";
    const targetKind = tank.ai?.targetKind ?? "none";
    modes[mode] = (modes[mode] ?? 0) + 1;
    targetKinds[targetKind] = (targetKinds[targetKind] ?? 0) + 1;
    if ((tank.ai?.panicUntilMs ?? 0) > game.timeMs) {
      panic += 1;
    }
    if (tank.ai?.targetId && (tank.ai?.recentAttackers?.[tank.ai.targetId] ?? 0) > game.timeMs) {
      revenge += 1;
    }
  }
  return { modes, targetKinds, panic, revenge };
}

export function recordBotDamageMemory(game, victimBot, projectile, appliedDamage = projectile?.damage ?? 0) {
  if (!victimBot || victimBot.kind !== "bot" || !projectile?.ownerId || projectile.ownerId === victimBot.id) {
    return;
  }
  const profile = ensureBotGovernanceFields(victimBot, game.timeMs);
  const damageRatio = Math.max(0, Number(appliedDamage) || 0) / Math.max(1, victimBot.maxHp);
  victimBot.ai.lastDamagedById = projectile.ownerId;
  victimBot.ai.lastDamagedAtMs = game.timeMs;
  victimBot.ai.recentAttackers[projectile.ownerId] = game.timeMs + profile.memoryMs;
  recordBotRivalDamageMemory(victimBot, projectile.ownerId, game.timeMs);
  if (damageRatio >= profile.panicDamageRatio) {
    victimBot.ai.panicUntilMs = Math.max(victimBot.ai.panicUntilMs, game.timeMs + profile.panicMs);
  }
}

export function getBotLevelCap(game) {
  const humans = getConnectedHumans(game);
  const governance = game.config.bots.governance;

  if (humans.length === 0) {
    return governance.maxLevelNoHumans;
  }

  const highestHumanLevel = humans.reduce((highest, tank) => Math.max(highest, tank.level), 1);
  return Math.min(
    governance.maxLevelWithHumans,
    highestHumanLevel + governance.maxLevelLeadOverHumans
  );
}

export function applyBotGovernance(game, bot) {
  const governance = game.config.bots.governance;
  ensureBotGovernanceFields(bot, game.timeMs);

  const elapsedMs = game.timeMs - bot.ai.lastGovernedAtMs;
  if (elapsedMs < governance.intervalMs) {
    return false;
  }

  const ageMs = game.timeMs - bot.ai.spawnedAtMs;
  const levelCap = getBotLevelCap(game);
  const humans = getAliveConnectedHumans(game);
  const isOverCap = bot.level > levelCap;
  const isExpired = ageMs >= governance.recycleAfterMs;

  if (ageMs >= governance.scoreDecayStartMs && bot.score > 0) {
    const decayFactor = Math.max(0, 1 - (governance.scoreDecayPerMinute * elapsedMs) / 60000);
    bot.score = Math.max(0, bot.score * decayFactor);
  }

  bot.ai.lastGovernedAtMs = game.timeMs;

  if (!isOverCap && !isExpired) {
    bot.ai.pendingRecycle = false;
    return false;
  }

  if (humans.length > 0 && !isFarFromHumans(bot, humans, governance.recycleDistanceFromHuman)) {
    bot.ai.pendingRecycle = true;
    return false;
  }

  recycleBot(game, bot);
  return true;
}

export function recycleBot(game, bot) {
  const profile = ensureBotGovernanceFields(bot, game.timeMs);
  const point = findSafeSpawn({
    state: game,
    radius: game.config.tank.radius,
    rng: game.rng,
    tankSafetyRadius: game.config.bots.aggroRange + 160,
    shapeSafetyRadius: 100,
    config: game.config
  });

  resetBotProgression(bot);
  clearBotRivalState(bot, game.timeMs);
  refreshTankStats(bot, game.config);
  expireOwnedProjectiles(game, bot.id);
  cleanupOwnerDrones(game, bot.id);

  bot.x = point.x;
  bot.y = point.y;
  bot.vx = 0;
  bot.vy = 0;
  bot.hp = bot.maxHp;
  bot.fireCooldownMs = 420;
  bot.lastDamageAtMs = -Infinity;
  bot.spawnedAtMs = game.timeMs;
  bot.respawnAtMs = 0;
  bot.killerName = "";
  bot.state = "alive";
  bot.input = {
    moveX: 0,
    moveY: 0,
    aimAngle: bot.aimAngle,
    fire: false,
    seq: bot.input.seq || 0
  };
  bot.ai = createBotAiState({
    nowMs: game.timeMs,
    x: point.x,
    y: point.y,
    profileId: profile.id
  });
}

function spawnBot(game) {
  const id = game.nextEntityId("bot");
  const index = game.botSerial;
  game.botSerial += 1;
  const nameRoot = game.config.bots.names[index % game.config.bots.names.length];
  const profileId = chooseBotProfile(game.rng);
  const profile = getBotProfile(profileId);
  const point = findSafeSpawn({
    state: game,
    radius: game.config.tank.radius,
    rng: game.rng,
    config: game.config
  });
  const color = game.config.tank.colors[index % game.config.tank.colors.length];
  const bot = createTank({
    id,
    name: `${profile.label} ${nameRoot}-${String(index + 1).padStart(2, "0")}`,
    x: point.x,
    y: point.y,
    color,
    kind: "bot",
    nowMs: game.timeMs,
    config: game.config
  });
  applyProfileToBot(bot, profile.id);
  bot.ai.reactionAtMs = game.timeMs + profile.reactionMs;

  // Give bots light early variance so the arena does not feel cloned.
  addXp(bot, Math.floor(game.rng() * 180), 0, game.config);
  autoSpendBotUpgrades(bot, game.config, profile);
  game.tanks.set(bot.id, bot);
}

function ensureBotGovernanceFields(bot, nowMs) {
  if (!bot.ai) {
    bot.ai = {};
  }
  const profile = applyProfileToBot(bot, bot.ai.profileId);
  bot.ai.spawnedAtMs ??= bot.spawnedAtMs ?? nowMs;
  bot.ai.lastGovernedAtMs ??= nowMs;
  bot.ai.pendingRecycle ??= false;
  bot.ai.mode ??= "wander";
  bot.ai.targetId ??= null;
  bot.ai.targetKind ??= "none";
  bot.ai.reactionAtMs ??= 0;
  bot.ai.wanderUntilMs ??= 0;
  bot.ai.wanderX ??= bot.x;
  bot.ai.wanderY ??= bot.y;
  bot.ai.aimErrorRadians ??= 0;
  bot.ai.targetStickUntilMs ??= 0;
  bot.ai.lastSeenTargets ??= {};
  bot.ai.recentAttackers ??= {};
  bot.ai.lastDamagedById ??= null;
  bot.ai.lastDamagedAtMs ??= -Infinity;
  bot.ai.frustration ??= 0;
  bot.ai.panicUntilMs ??= 0;
  bot.ai.mistakeUntilMs ??= 0;
  bot.ai.commitUntilMs ??= 0;
  bot.ai.objectiveInterestUntilMs ??= 0;
  ensureBotRivalState(bot, nowMs);
  return profile;
}

function resetBotProgression(bot) {
  const fresh = createProgression();
  bot.level = fresh.level;
  bot.xp = fresh.xp;
  bot.score = fresh.score;
  bot.upgradePoints = fresh.upgradePoints;
  bot.classId = "basic";
  bot.classHistory = ["basic"];
  bot.classUnlockChoices = [];
  for (const key of UPGRADE_KEYS) {
    bot.upgrades[key] = fresh.upgrades[key];
  }
}

function expireOwnedProjectiles(game, ownerId) {
  for (const projectile of game.projectiles.values()) {
    if (projectile.ownerId === ownerId) {
      projectile.state = "expired";
    }
  }
}

function getConnectedHumans(game) {
  return [...game.tanks.values()].filter(
    (tank) => tank.kind === "player" && tank.disconnectedAtMs === null
  );
}

function getAliveConnectedHumans(game) {
  return getConnectedHumans(game).filter((tank) => tank.state === "alive");
}

function isFarFromHumans(bot, humans, distance) {
  const distanceSquared = distance * distance;
  return humans.every((human) => distanceSq(bot, human) >= distanceSquared);
}

function findBestEnemy(game, bot, profile, spatialIndex = null) {
  const range = game.config.bots.aggroRange * profile.aggroRangeMultiplier;
  const rangeSq = range * range;
  let best = null;
  let bestScore = -Infinity;
  const candidates = getNearbyCandidates(game, bot, range, "tank", spatialIndex);

  for (const tank of candidates) {
    if (tank.id === bot.id || tank.state !== "alive" || game.isTankInvulnerable(tank)) {
      continue;
    }

    const dist = distanceSq(bot, tank);
    if (dist > rangeSq) {
      continue;
    }
    rememberSeenTarget(bot, tank, game.timeMs, profile);
    const score = scoreEnemyTarget(bot, tank, profile, game.timeMs);
    if (score > bestScore || (score === bestScore && (!best || tank.id < best.id))) {
      best = tank;
      bestScore = score;
    }
  }

  return best;
}

function findBestShape(game, bot, profile, spatialIndex = null) {
  const farmRange = game.config.bots.farmRange * Math.min(1.35, Math.max(0.65, profile.farmBias));
  const eventRange = EVENT_OBJECTIVE_CONFIG.bot.eventInterestRange;
  const queryRange = Math.max(farmRange, eventRange);
  let best = null;
  let bestScore = -Infinity;
  const candidates = getNearbyCandidates(game, bot, queryRange, "shape", spatialIndex);

  for (const shape of candidates) {
    if (shape.state !== "alive") {
      continue;
    }

    const dist = distanceSq(bot, shape);
    const rangeSq = (shape.isEventObjective ? eventRange : farmRange) ** 2;
    if (dist > rangeSq) {
      continue;
    }
    rememberSeenTarget(bot, shape, game.timeMs, profile);
    const score = scoreShapeTarget(bot, shape, profile, game);
    if (score > bestScore || (score === bestScore && (!best || shape.id < best.id))) {
      best = shape;
      bestScore = score;
    }
  }

  return best;
}

function findBestDrone(game, bot, profile) {
  const range = game.config.bots.aggroRange * profile.aggroRangeMultiplier * 0.82;
  const rangeSq = range * range;
  let best = null;
  let bestScore = -Infinity;
  for (const drone of game.drones?.values?.() ?? []) {
    if (drone.state !== "active" || drone.ownerId === bot.id || distanceSq(bot, drone) > rangeSq) {
      continue;
    }
    const owner = game.tanks.get(drone.ownerId);
    if (!owner || owner.kind === bot.kind && owner.kind === "bot") {
      continue;
    }
    rememberSeenTarget(bot, drone, game.timeMs, profile);
    const score = scoreDroneTarget(bot, drone, profile);
    if (score > bestScore || (score === bestScore && (!best || drone.id < best.id))) {
      best = drone;
      bestScore = score;
    }
  }
  return best;
}

export function scoreEnemyTarget(bot, enemy, profile = getBotProfile(), nowMs = 0) {
  if (!enemy) {
    return -Infinity;
  }
  const distance = Math.sqrt(distanceSq(bot, enemy));
  const hpRatio = Math.max(0, Math.min(1, enemy.hp / Math.max(1, enemy.maxHp)));
  const revengeBonus = (bot.ai?.recentAttackers?.[enemy.id] ?? 0) > nowMs ? profile.revengeBias : 0;
  const rivalRevengeBonus = getBotRivalTargetScoreBonus(bot, enemy, nowMs);
  const levelOpportunityBonus = Math.max(0, (enemy.level ?? 1) - (bot.level ?? 1)) * 0.05 * profile.greedBias;
  const humanFocusBonus = enemy.kind === "player" ? 0.22 * profile.humanFocusBias : 0;
  const dangerPenalty = Math.max(0, (enemy.level ?? 1) - (bot.level ?? 1) - 3) * 0.04;
  return (
    profile.aggression * (900 / Math.max(240, distance)) +
    (1 - hpRatio) * profile.aggression +
    revengeBonus +
    rivalRevengeBonus +
    levelOpportunityBonus +
    humanFocusBonus -
    dangerPenalty
  );
}

export function scoreDroneTarget(bot, drone, profile = getBotProfile()) {
  if (!drone) {
    return -Infinity;
  }
  const distance = Math.sqrt(distanceSq(bot, drone));
  const hpRatio = Math.max(0, Math.min(1, drone.hp / Math.max(1, drone.maxHp)));
  return profile.aggression * 0.42 * (260 / Math.max(180, distance)) + (1 - hpRatio) * 0.25;
}

export function scoreShapeTarget(bot, shape, profile = getBotProfile(), game = null) {
  if (!shape) {
    return -Infinity;
  }
  const distance = Math.sqrt(distanceSq(bot, shape));
  if (shape.isEventObjective) {
    const hpRatio = Math.max(0, Math.min(1, (bot.hp ?? 0) / Math.max(1, bot.maxHp ?? 1)));
    const retreatHpRatio = Math.max(0, Number(profile.retreatHpRatio) || 0);
    const hpConfidence = Math.max(0, Math.min(1, (hpRatio - retreatHpRatio) / 0.45));
    const nearbyHumanCount = game ? countNearbyHumans(game, shape, EVENT_OBJECTIVE_CONFIG.bot.humanDampenerRadius) : 0;
    const humanDampener = nearbyHumanCount > 0 ? EVENT_OBJECTIVE_CONFIG.bot.humanDampener : 1;
    const eventBias = Number(profile.eventBias ?? 0.4);
    const eventMultiplier = Number(shape.eventBotInterestMultiplier ?? 1);
    return profile.farmBias *
      eventBias *
      eventMultiplier *
      humanDampener *
      hpConfidence *
      ((shape.xp ?? 1) / Math.max(300, distance));
  }
  const centerWeight = isCenterObjectiveShape(shape)
    ? getCenterObjectiveBotTargetWeight(profile.id)
    : 1;
  const alphaBias = isCenterObjectiveShape(shape) ? profile.alphaContestBias : 1;
  return profile.farmBias * centerWeight * alphaBias * ((shape.xp ?? 1) / Math.max(200, distance));
}

export function chooseBotGoal(game, bot, enemy, shape, profile = getBotProfile(bot.ai?.profileId), drone = null) {
  const enemyScore = scoreEnemyTarget(bot, enemy, profile, game.timeMs);
  const shapeScore = scoreShapeTarget(bot, shape, profile, game);
  const droneScore = scoreDroneTarget(bot, drone, profile);
  const next = [
    { type: "tank", entity: enemy, score: enemyScore },
    { type: "shape", entity: shape, score: shapeScore },
    { type: "drone", entity: drone, score: droneScore }
  ].sort((a, b) => b.score - a.score)[0];
  if (!next.entity) {
    return null;
  }

  const current = getCurrentTarget(game, bot);
  if (current && game.timeMs < bot.ai.targetStickUntilMs) {
    const currentScore = current.type === "tank"
      ? scoreEnemyTarget(bot, current.entity, profile, game.timeMs)
      : current.type === "drone"
        ? scoreDroneTarget(bot, current.entity, profile)
        : scoreShapeTarget(bot, current.entity, profile, game);
    if (!shouldSwitchTarget(bot, currentScore, next.score, profile)) {
      return current;
    }
  }

  bot.ai.targetStickUntilMs = game.timeMs + profile.targetCommitMs;
  return next;
}

export function shouldSwitchTarget(bot, currentScore, nextScore, profile = getBotProfile(bot.ai?.profileId)) {
  if (!Number.isFinite(currentScore) || currentScore === -Infinity) {
    return true;
  }
  return nextScore >= currentScore * profile.targetSwitchHysteresis;
}

function getNearbyCandidates(game, bot, range, type, spatialIndex) {
  const padding = game.config.performance?.botQueryRadiusPadding ?? 80;
  const candidates = spatialIndex?.queryCircle
    ? spatialIndex.queryCircle(bot.x, bot.y, range + bot.radius + padding)
    : type === "tank"
      ? [...game.tanks.values()]
      : [...game.shapes.values()];
  if (game.performanceStats) {
    game.performanceStats.aiCandidateChecks += candidates.length;
  }
  return candidates.filter((candidate) => candidate.type === type);
}

function setRetreatIntent(game, bot, enemy, profile) {
  const away = normalize(bot.x - enemy.x, bot.y - enemy.y);
  bot.ai.mode = "retreat";
  bot.ai.targetId = enemy.id;
  bot.ai.targetKind = "tank";
  bot.input.moveX = away.x + (game.rng() * 2 - 1) * profile.strafeStrength * 0.35;
  bot.input.moveY = away.y + (game.rng() * 2 - 1) * profile.strafeStrength * 0.35;
  bot.input.aimAngle = applyAimJitter(game, bot, getLeadAngle(game, bot, enemy, profile), profile);
  bot.input.fire = game.rng() <= profile.fireDiscipline;
}

function setCombatIntent(game, bot, enemy, profile) {
  const toEnemy = normalize(enemy.x - bot.x, enemy.y - bot.y);
  const dist = Math.sqrt(distanceSq(bot, enemy));
  const strafe = { x: -toEnemy.y * profile.strafeStrength, y: toEnemy.x * profile.strafeStrength };
  const preferredRange = game.config.bots.preferredCombatRange * profile.preferredRangeMultiplier;
  const forward = dist > preferredRange ? 0.75 : -0.2;
  const effectiveAggro = game.config.bots.aggroRange * profile.aggroRangeMultiplier;

  bot.ai.mode = "chaseEnemy";
  bot.ai.targetId = enemy.id;
  bot.ai.targetKind = "tank";
  bot.input.moveX = toEnemy.x * forward + strafe.x;
  bot.input.moveY = toEnemy.y * forward + strafe.y;
  bot.input.aimAngle = applyAimJitter(game, bot, getLeadAngle(game, bot, enemy, profile), profile);
  bot.input.fire = dist <= effectiveAggro && game.rng() <= profile.fireDiscipline;
}

function setDroneCombatIntent(game, bot, drone, profile) {
  setCombatIntent(game, bot, drone, profile);
  bot.ai.mode = "antiDrone";
  bot.ai.targetId = drone.id;
  bot.ai.targetKind = "drone";
}

function setFarmIntent(game, bot, shape, profile) {
  const toShape = normalize(shape.x - bot.x, shape.y - bot.y);
  const dist = Math.sqrt(distanceSq(bot, shape));

  bot.ai.mode = shape.isEventObjective ? "contestEvent" : isCenterObjectiveShape(shape) ? "contestAlpha" : "farmShape";
  bot.ai.targetId = shape.id;
  bot.ai.targetKind = shape.isEventObjective ? "event" : isCenterObjectiveShape(shape) ? "alpha" : "shape";
  bot.input.moveX = dist > 220 ? toShape.x : 0;
  bot.input.moveY = dist > 220 ? toShape.y : 0;
  bot.input.aimAngle = applyAimJitter(game, bot, Math.atan2(shape.y - bot.y, shape.x - bot.x), profile);
  bot.input.fire = game.rng() <= Math.max(0.35, profile.fireDiscipline);
}

function setWanderIntent(game, bot, profile) {
  if (game.timeMs >= bot.ai.wanderUntilMs) {
    const margin = 300;
    bot.ai.wanderX = margin + game.rng() * (game.config.world.width - margin * 2);
    bot.ai.wanderY = margin + game.rng() * (game.config.world.height - margin * 2);
    bot.ai.wanderUntilMs = game.timeMs + game.config.bots.wanderRetargetMs;
  }

  const move = normalize(bot.ai.wanderX - bot.x, bot.ai.wanderY - bot.y);
  bot.ai.mode = "wander";
  bot.ai.targetId = null;
  bot.ai.targetKind = "none";
  const wanderSpeed = 0.5 + profile.aggression * 0.15;
  bot.input.moveX = move.x * wanderSpeed;
  bot.input.moveY = move.y * wanderSpeed;
  bot.input.aimAngle = Math.atan2(move.y, move.x);
  bot.input.fire = false;
}

function applyAimJitter(game, bot, baseAngle, profile) {
  bot.ai.aimErrorRadians = (game.rng() * 2 - 1) * profile.aimJitterRadians;
  return baseAngle + bot.ai.aimErrorRadians;
}

function getLeadAngle(game, bot, target, profile) {
  const stats = getClassAdjustedTankStats(getTankStats(bot.upgrades, game.config), bot.classId);
  const distance = Math.sqrt(distanceSq(bot, target));
  const leadSeconds = distance / Math.max(1, stats.bulletSpeed);
  const predictedX = target.x + (target.vx ?? 0) * leadSeconds * profile.aimLeadStrength;
  const predictedY = target.y + (target.vy ?? 0) * leadSeconds * profile.aimLeadStrength;
  return Math.atan2(predictedY - bot.y, predictedX - bot.x);
}

export function applyBotMistake(game, bot, profile = getBotProfile(bot.ai?.profileId)) {
  if (game.timeMs < bot.ai.mistakeUntilMs) {
    return;
  }
  if (game.rng() > profile.mistakeChance) {
    return;
  }
  bot.ai.mistakeUntilMs = game.timeMs + profile.reactionMs;
  const roll = game.rng();
  if (roll < 0.4) {
    bot.input.fire = false;
    return;
  }
  if (roll < 0.75) {
    bot.input.aimAngle += (game.rng() * 2 - 1) * profile.aimJitterRadians * 2.5;
    return;
  }
  bot.input.moveX *= -0.35;
  bot.input.moveY *= -0.35;
}

function autoSpendBotUpgrades(bot, config = GAME_CONFIG, profile = getBotProfile(bot.ai?.profileId)) {
  let guard = 20;
  while (bot.upgradePoints > 0 && guard > 0) {
    guard -= 1;
    const priority = profile.upgradePriority?.length ? profile.upgradePriority : FALLBACK_UPGRADE_PRIORITY;
    const key = priority.find((candidate) => bot.upgrades[candidate] < config.upgrades.maxLevel)
      ?? UPGRADE_KEYS.find((candidate) => bot.upgrades[candidate] < config.upgrades.maxLevel);
    if (!key || !applyUpgrade(bot, key, config)) {
      break;
    }
    refreshTankStats(bot, config);
  }
}

function autoSelectBotClass(bot, config = GAME_CONFIG, profile = getBotProfile(bot.ai?.profileId)) {
  const choices = getAvailableClassChoices(bot);
  if (choices.length === 0) {
    return false;
  }
  const selected = profile.classPreference.find((classId) => choices.includes(classId)) ?? choices[0];
  if (!selectTankClass(bot, selected)) {
    return false;
  }
  refreshTankStats(bot, config);
  return true;
}

function createBotAiState({ nowMs, x, y, profileId }) {
  const profile = getBotProfile(profileId);
  return {
    mode: "wander",
    targetId: null,
    reactionAtMs: nowMs + profile.reactionMs,
    wanderUntilMs: 0,
    wanderX: x,
    wanderY: y,
    spawnedAtMs: nowMs,
    lastGovernedAtMs: nowMs,
    pendingRecycle: false,
    profileId: profile.id,
    profileLabel: profile.label,
    aimErrorRadians: 0,
    targetStickUntilMs: 0,
    targetKind: "none",
    lastSeenTargets: {},
    recentAttackers: {},
    lastDamagedById: null,
    lastDamagedAtMs: -Infinity,
    frustration: 0,
    panicUntilMs: 0,
    mistakeUntilMs: 0,
    commitUntilMs: 0,
    objectiveInterestUntilMs: 0,
    rival: createBotRivalState(nowMs)
  };
}

function getCurrentTarget(game, bot) {
  if (!bot.ai?.targetId) {
    return null;
  }
  if (bot.ai.targetKind === "tank") {
    const tank = game.tanks.get(bot.ai.targetId);
    return tank?.state === "alive" ? { type: "tank", entity: tank, score: 0 } : null;
  }
  if (bot.ai.targetKind === "shape" || bot.ai.targetKind === "alpha" || bot.ai.targetKind === "event") {
    const shape = game.shapes.get(bot.ai.targetId);
    return shape?.state === "alive" ? { type: "shape", entity: shape, score: 0 } : null;
  }
  if (bot.ai.targetKind === "drone") {
    const drone = game.drones?.get?.(bot.ai.targetId);
    return drone?.state === "active" ? { type: "drone", entity: drone, score: 0 } : null;
  }
  return null;
}

function countNearbyHumans(game, point, radius) {
  const radiusSq = radius * radius;
  let count = 0;
  for (const tank of game.tanks.values()) {
    if (tank.kind !== "player" || tank.state !== "alive" || tank.disconnectedAtMs !== null) {
      continue;
    }
    if (distanceSq(tank, point) <= radiusSq) {
      count += 1;
    }
  }
  return count;
}

function rememberSeenTarget(bot, entity, nowMs, profile) {
  bot.ai.lastSeenTargets[entity.id] = {
    kind: entity.type,
    seenUntilMs: nowMs + profile.memoryMs
  };
}

function pruneBotMemory(bot, nowMs) {
  for (const [id, entry] of Object.entries(bot.ai.lastSeenTargets ?? {})) {
    if ((entry.seenUntilMs ?? 0) <= nowMs) {
      delete bot.ai.lastSeenTargets[id];
    }
  }
  for (const [id, expiresAt] of Object.entries(bot.ai.recentAttackers ?? {})) {
    if (expiresAt <= nowMs) {
      delete bot.ai.recentAttackers[id];
    }
  }
}
