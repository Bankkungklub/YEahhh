import { APP_CONFIG } from "../../shared/config/appConfig.js";
import { COMBAT_FEEDBACK_CONFIG } from "../../shared/config/combatFeedbackConfig.js";
import { DRONE_CONFIG, getPublicDroneConfig, validateDroneConfig } from "../../shared/config/droneConfig.js";
import { EVENT_OBJECTIVE_CONFIG, getPublicEventObjectiveConfig, validateEventObjectiveConfig } from "../../shared/config/eventObjectiveConfig.js";
import { validateBotProfileConfig } from "../../shared/config/botProfileConfig.js";
import { COMBAT_FEEL_CONFIG, validateCombatFeelConfig } from "../../shared/config/combatFeelConfig.js";
import { GAME_CONFIG, UPGRADE_KEYS, getPublicConfig, getTankStats, validateConfig } from "../../shared/config/gameConfig.js";
import { getPublicTankClassConfig } from "../../shared/config/tankClassConfig.js";
import { circleIntersects, getFirstCircleHit } from "../../shared/sim/collision.js";
import { calculateTankShapeContactDamage, calculateTankTankContactDamage, getContactResolution, pushCircleIntoWorld } from "../../shared/sim/contactCollision.js";
import { normalizeAccountCosmetics } from "../../shared/sim/cosmetics.js";
import { createProjectile, createShape, createTank, refreshTankStats } from "../../shared/sim/entityFactory.js";
import { applyMatchCoinCap, coinsForShape, coinsForTankKill } from "../../shared/sim/economy.js";
import { createDamageSourceInfo, isContactDamageCause } from "../../shared/sim/damageSources.js";
import { addXp, applyDeathProgressionPenalty, applyUpgrade, getTotalUpgradeBudgetForLevel, xpForNextLevel, xpRewardForTankKill } from "../../shared/sim/progression.js";
import {
  canClaimBotBounty,
  clearBotRivalState,
  getBotBountyReward,
  getBotRivalDebug,
  getBotRivalSnapshots,
  markBotBountyClaimed,
  pruneBotBountyClaims as pruneBotBountyClaimRecords,
  recordBotRivalKill
} from "../../shared/sim/botRivals.js";
import { buildSpatialHash } from "../../shared/sim/spatialHash.js";
import {
  canProjectileHitTarget,
  canTrapBlockProjectile,
  createExplosionSparkProjectiles,
  getProjectileKindCounts,
  recordProjectileTargetHit,
  recordTrapProjectileBlock,
  shouldDetonateProjectile,
  updateProjectileBehavior
} from "../../shared/sim/projectileBehaviors.js";
import { downgradeClassForLevel, getAvailableClassChoices, getClassAdjustedTankStats, getDroneLoadoutId, getTankClassName, getWeaponPattern, refreshClassUnlocks, selectTankClass } from "../../shared/sim/tankClasses.js";
import { simulateTankMotion } from "../../shared/sim/tankMotion.js";
import { applyRecoilImpulse, computeFireRecoilImpulse, decayRecoilVelocity, summarizeRecoilImpulse } from "../../shared/sim/tankRecoil.js";
import { normalize } from "../../shared/sim/vector.js";
import { getBotBehaviorDebugCounts, getBotClassDebugCounts, getBotProfileCounts, maintainBotPopulation, recordBotDamageMemory, updateBots } from "./botController.js";
import {
  completeCenterObjectiveIfNeeded,
  ensureCenterObjectiveState,
  getCenterObjectiveDebug,
  getCenterObjectiveSnapshot,
  getShapeTypeCounts,
  maintainCenterObjective,
  recordObjectiveHit
} from "./centerObjectiveSystem.js";
import {
  completeEventShapeIfNeeded,
  ensureEventObjectiveState,
  getEventObjectiveDebug,
  getEventObjectiveSnapshots,
  getEventShapeDamageMultiplier,
  maintainEventObjectives,
  recordEventShapeHit
} from "./eventObjectiveSystem.js";
import {
  cleanupInvalidDrones,
  cleanupOwnerDrones,
  damageDroneWithProjectile,
  ensureDroneState,
  getDroneDebug,
  getDroneSnapshots,
  getLocalDroneStatus,
  getProjectileDroneHit,
  handleNecromancerShapeConversion,
  maintainDrones,
  resolveDroneContactDamage
} from "./droneSystem.js";
import { chooseShapeType, findSafeSpawn, getNormalShapeBlockedZones } from "./spawnSystem.js";

export class ServerGame {
  constructor({ config = GAME_CONFIG, appConfig = APP_CONFIG, accountStore = null, rng = Math.random } = {}) {
    const issues = [
      ...validateConfig(config),
      ...validateBotProfileConfig(),
      ...validateCombatFeelConfig(),
      ...validateEventObjectiveConfig(),
      ...validateDroneConfig()
    ];
    if (issues.length > 0) {
      throw new Error(`Invalid game config: ${issues.join(" ")}`);
    }

    this.config = config;
    this.appConfig = appConfig;
    this.accountStore = accountStore;
    this.rng = rng;
    this.tick = 0;
    this.timeMs = 0;
    this.entitySerial = 1;
    this.botSerial = 0;
    this.tanks = new Map();
    this.projectiles = new Map();
    this.drones = ensureDroneState(this);
    this.shapes = new Map();
    this.pendingEvents = [];
    this.pendingWeaponShots = [];
    this.botBountyClaims = [];
    this.weaponFireSerial = 0;
    this.clientToPlayer = new Map();
    this.spatialIndex = null;
    this.centerObjective = ensureCenterObjectiveState(this);
    this.eventObjectives = ensureEventObjectiveState(this);
    this.maxCollisionCandidateRadius = Math.max(
      config.tank.radius,
      ...Object.values(config.shapes.types).map((shape) => shape.radius),
      ...Object.values(EVENT_OBJECTIVE_CONFIG.objectives).map((objective) => objective.radius),
      ...Object.values(DRONE_CONFIG.loadouts).map((loadout) => loadout.radius)
    );
    this.performanceStats = createPerformanceStats(config);

    maintainCenterObjective(this);
    maintainEventObjectives(this);
    this.maintainShapes();
  }

  nextEntityId(prefix = "entity") {
    const id = `${prefix}-${this.entitySerial}`;
    this.entitySerial += 1;
    return id;
  }

  createHumanPlayer(clientId, name, options = {}) {
    const existingId = this.clientToPlayer.get(clientId);
    if (existingId && this.tanks.has(existingId)) {
      return this.tanks.get(existingId);
    }

    const colorIndex = this.clientToPlayer.size % this.config.tank.colors.length;
    const point = findSafeSpawn({
      state: this,
      radius: this.config.tank.radius,
      rng: this.rng,
      tankSafetyRadius: this.config.bots.aggroRange + 160,
      shapeSafetyRadius: 100,
      config: this.config
    });

    const tank = createTank({
      id: this.nextEntityId("player"),
      clientId,
      name,
      x: point.x,
      y: point.y,
      color: this.config.tank.colors[colorIndex],
      kind: "player",
      nowMs: this.timeMs,
      config: this.config,
      accountId: options.account?.id ?? null,
      cosmetics: getLoadoutForAccount(options.account)
    });

    this.tanks.set(tank.id, tank);
    this.clientToPlayer.set(clientId, tank.id);
    return tank;
  }

  markDisconnected(clientId) {
    const playerId = this.clientToPlayer.get(clientId);
    const tank = this.tanks.get(playerId);
    if (!tank) {
      return;
    }
    tank.disconnectedAtMs = this.timeMs;
    this.clearPendingWeaponShots(tank.id);
    cleanupOwnerDrones(this, tank.id);
  }

  receiveInput(playerId, input) {
    const tank = this.tanks.get(playerId);
    if (!tank || tank.kind !== "player" || tank.state !== "alive") {
      return false;
    }

    const currentSeq = tank.input?.seq ?? 0;
    const seq = Math.max(0, Math.trunc(Number(input.seq) || 0));
    if (seq < currentSeq) {
      return false;
    }
    const move = normalize(input.moveX, input.moveY);
    tank.input = {
      moveX: move.x,
      moveY: move.y,
      aimAngle: input.aimAngle,
      fire: input.fire,
      seq
    };
    return true;
  }

  applyUpgrade(playerId, key) {
    const tank = this.tanks.get(playerId);
    if (!tank || tank.state !== "alive") {
      return false;
    }

    const upgraded = applyUpgrade(tank, key, this.config);
    if (upgraded) {
      refreshTankStats(tank, this.config);
    }
    return upgraded;
  }

  selectTankClass(playerId, classId) {
    const tank = this.tanks.get(playerId);
    if (!tank || tank.state !== "alive") {
      return false;
    }
    const selected = selectTankClass(tank, classId);
    if (!selected) {
      return false;
    }
    this.clearPendingWeaponShots(tank.id);
    cleanupOwnerDrones(this, tank.id);
    refreshTankStats(tank, this.config);
    tank.fireCooldownMs = Math.max(tank.fireCooldownMs, 240);
    tank.nextDroneRebuildAtMs = this.timeMs;
    return true;
  }

  setDeveloperLevelForAccount(accountId, level) {
    const safeLevel = Math.max(1, Math.min(
      this.config.upgrades.maxPlayerLevel,
      Math.trunc(Number(level) || 1)
    ));
    const updated = [];
    for (const tank of this.tanks.values()) {
      if (tank.kind !== "player" || tank.accountId !== accountId) {
        continue;
      }
      const before = {
        level: tank.level,
        classId: tank.classId,
        upgradePoints: tank.upgradePoints
      };
      tank.level = safeLevel;
      tank.xp = 0;
      for (const key of UPGRADE_KEYS) {
        tank.upgrades[key] = 0;
      }
      tank.upgradePoints = getTotalUpgradeBudgetForLevel(safeLevel);
      downgradeClassForLevel(tank, safeLevel);
      this.clearPendingWeaponShots(tank.id);
      cleanupOwnerDrones(this, tank.id);
      refreshClassUnlocks(tank);
      refreshTankStats(tank, this.config);
      tank.nextDroneRebuildAtMs = this.timeMs;
      if (tank.state === "alive") {
        tank.hp = tank.maxHp;
      }
      updated.push({
        playerId: tank.id,
        name: tank.name,
        before,
        after: {
          level: tank.level,
          classId: tank.classId,
          upgradePoints: tank.upgradePoints,
          classUnlockChoices: tank.classUnlockChoices
        }
      });
    }
    return updated;
  }

  requestRespawn(playerId) {
    const tank = this.tanks.get(playerId);
    if (!tank || tank.state !== "dead" || this.timeMs < tank.respawnAtMs) {
      return false;
    }
    this.respawnTank(tank);
    return true;
  }

  respawnTank(tank) {
    const point = findSafeSpawn({
      state: this,
      radius: this.config.tank.radius,
      rng: this.rng,
      tankSafetyRadius: this.config.bots.aggroRange + 160,
      shapeSafetyRadius: 100,
      config: this.config
    });

    refreshTankStats(tank, this.config);
    this.refreshTankCosmetics(tank);
    tank.x = point.x;
    tank.y = point.y;
    tank.vx = 0;
    tank.vy = 0;
    tank.hp = tank.maxHp;
    tank.fireCooldownMs = 420;
    tank.lastDamageAtMs = -Infinity;
    tank.spawnedAtMs = this.timeMs;
    tank.respawnAtMs = 0;
    tank.killerName = "";
    tank.state = "alive";
    this.clearPendingWeaponShots(tank.id);
    tank.input = {
      moveX: 0,
      moveY: 0,
      aimAngle: tank.aimAngle,
      fire: false,
      seq: tank.input.seq || 0
    };
    tank.nextDroneRebuildAtMs = this.timeMs;
  }

  step(dtSeconds) {
    const dtMs = dtSeconds * 1000;
    this.timeMs += dtMs;
    this.tick += 1;

    this.resetPerformanceStats();
    maintainCenterObjective(this);
    maintainEventObjectives(this);
    this.maintainShapes();
    maintainBotPopulation(this);
    this.rebuildSpatialIndex();
    updateBots(this);
    this.updateTanks(dtSeconds, dtMs);
    this.processPendingWeaponShots();
    maintainDrones(this, dtSeconds, dtMs);
    this.rebuildSpatialIndex();
    this.resolveContactCollisions(dtSeconds);
    resolveDroneContactDamage(this, dtSeconds);
    this.updateProjectiles(dtSeconds, dtMs);
    this.rebuildSpatialIndex();
    this.resolveProjectileHits();
    this.cleanupEntities();
  }

  maintainShapes() {
    const normalShapeCount = [...this.shapes.values()]
      .filter((shape) => !shape.isCenterObjective && !shape.isEventObjective).length;
    const missing = this.config.shapes.targetCount - normalShapeCount;
    for (let i = 0; i < missing; i += 1) {
      const shapeType = chooseShapeType(this.rng, this.config);
      const shapeConfig = this.config.shapes.types[shapeType];
      const point = findSafeSpawn({
        state: this,
        radius: shapeConfig.radius,
        rng: this.rng,
        safetyRadius: 90,
        blockedZones: getNormalShapeBlockedZones(this.config),
        config: this.config
      });
      const shape = createShape({
        id: this.nextEntityId("shape"),
        shapeType,
        x: point.x,
        y: point.y,
        config: this.config
      });
      this.shapes.set(shape.id, shape);
    }
  }

  updateTanks(dtSeconds, dtMs) {
    for (const tank of this.tanks.values()) {
      if (tank.state !== "alive") {
        continue;
      }

      const stats = getTankStats(tank.upgrades, this.config);
      const classStats = getClassAdjustedTankStats(stats, tank.classId);
      refreshClassUnlocks(tank);
      tank.maxHp = classStats.maxHp;
      tank.radius = classStats.radius;
      tank.fireCooldownMs = Math.max(0, tank.fireCooldownMs - dtMs);
      tank.aimAngle = Number.isFinite(tank.input.aimAngle) ? tank.input.aimAngle : tank.aimAngle;

      const motion = simulateTankMotion({
        tank,
        input: tank.input,
        moveSpeed: classStats.moveSpeed,
        dtSeconds,
        world: this.config.world
      });
      tank.x = motion.x + (tank.recoilX ?? 0) * dtSeconds;
      tank.y = motion.y + (tank.recoilY ?? 0) * dtSeconds;
      pushCircleIntoWorld(tank, this.config.world);
      tank.vx = motion.vx + (tank.recoilX ?? 0);
      tank.vy = motion.vy + (tank.recoilY ?? 0);
      this.decayTankRecoil(tank, dtSeconds);

      if (tank.input.fire && tank.fireCooldownMs <= 0) {
        const spawned = this.spawnProjectile(tank);
        this.applyFireRecoil(tank, spawned);
        tank.fireCooldownMs = classStats.reloadMs;
      }

      if (tank.hp < tank.maxHp && this.timeMs - tank.lastDamageAtMs >= classStats.regenDelayMs) {
        tank.hp = Math.min(tank.maxHp, tank.hp + classStats.regenPerSecond * dtSeconds);
      }
    }
  }

  spawnProjectile(tank) {
    if (getDroneLoadoutId(tank.classId)) {
      return [];
    }
    const pattern = getWeaponPattern(tank.classId);
    const spawned = [];
    const fireSerial = this.weaponFireSerial += 1;
    const aimAngle = Number.isFinite(tank.aimAngle) ? tank.aimAngle : 0;
    for (const shot of pattern) {
      const delayMs = Math.max(0, Math.trunc(Number(shot.delayMs) || 0));
      if (delayMs > 0) {
        this.pendingWeaponShots.push({
          ownerId: tank.id,
          classId: tank.classId,
          shot: { ...shot },
          spawnAtMs: this.timeMs + delayMs,
          aimAngle,
          fireSerial
        });
        continue;
      }
      spawned.push(this.spawnProjectileShot(tank, shot, aimAngle));
    }
    return spawned;
  }

  spawnProjectileShot(tank, shot, aimAngle = tank.aimAngle) {
    const prefix = shot.kind === "trap" ? "trap" : shot.kind === "rocket" ? "rocket" : "bullet";
    const owner = Number.isFinite(aimAngle)
      ? { ...tank, aimAngle }
      : tank;
    const projectile = createProjectile({
      id: this.nextEntityId(prefix),
      owner,
      nowMs: this.timeMs,
      config: this.config,
      ...shot
    });
    this.projectiles.set(projectile.id, projectile);
    return projectile;
  }

  processPendingWeaponShots() {
    if (this.pendingWeaponShots.length === 0) {
      return [];
    }
    const spawned = [];
    const remaining = [];
    const pending = [...this.pendingWeaponShots].sort((a, b) => {
      const timeDelta = a.spawnAtMs - b.spawnAtMs;
      return timeDelta !== 0 ? timeDelta : a.fireSerial - b.fireSerial;
    });

    for (const queued of pending) {
      const owner = this.tanks.get(queued.ownerId);
      if (!this.canEmitPendingWeaponShot(owner, queued)) {
        continue;
      }
      if (queued.spawnAtMs > this.timeMs) {
        remaining.push(queued);
        continue;
      }
      const projectile = this.spawnProjectileShot(owner, queued.shot, queued.aimAngle);
      spawned.push(projectile);
      this.applyFireRecoil(owner, [projectile]);
    }

    this.pendingWeaponShots = remaining;
    return spawned;
  }

  canEmitPendingWeaponShot(owner, queued) {
    return Boolean(
      owner &&
      owner.state === "alive" &&
      owner.disconnectedAtMs == null &&
      owner.classId === queued.classId &&
      !getDroneLoadoutId(owner.classId)
    );
  }

  clearPendingWeaponShots(ownerId = null) {
    if (ownerId == null) {
      this.pendingWeaponShots = [];
      return;
    }
    this.pendingWeaponShots = this.pendingWeaponShots.filter((queued) => queued.ownerId !== ownerId);
  }

  applyFireRecoil(tank, projectiles) {
    if (!COMBAT_FEEL_CONFIG.recoil.enabled || !projectiles?.length || tank.state !== "alive") {
      return;
    }
    const impulse = computeFireRecoilImpulse({
      tank,
      projectiles,
      aimAngle: tank.aimAngle,
      classRecoilMultiplier: tank.recoilMultiplier ?? 1,
      baseProjectileRadius: this.config.projectile.radius,
      config: COMBAT_FEEL_CONFIG
    });
    applyRecoilImpulse(tank, impulse, COMBAT_FEEL_CONFIG);
    tank.lastFireImpulse = summarizeRecoilImpulse(impulse);
    tank.barrelKickUntilMs = this.timeMs + COMBAT_FEEL_CONFIG.muzzle.flashMs;
  }

  decayTankRecoil(tank, dtSeconds) {
    decayRecoilVelocity(tank, dtSeconds, COMBAT_FEEL_CONFIG);
  }

  updateProjectiles(dtSeconds, dtMs) {
    for (const projectile of this.projectiles.values()) {
      if (projectile.state !== "active") {
        continue;
      }

      updateProjectileBehavior(projectile, dtMs, COMBAT_FEEL_CONFIG, {
        dtSeconds,
        targets: projectile.behavior === "missile" ? this.getMissileBehaviorTargets(projectile) : []
      });
      projectile.prevX = projectile.x;
      projectile.prevY = projectile.y;
      projectile.x += projectile.vx * dtSeconds;
      projectile.y += projectile.vy * dtSeconds;
      projectile.ageMs += dtMs;

      const outsideWorld =
        projectile.x < -projectile.radius ||
        projectile.y < -projectile.radius ||
        projectile.x > this.config.world.width + projectile.radius ||
        projectile.y > this.config.world.height + projectile.radius;

      if (projectile.ageMs >= projectile.ttlMs || outsideWorld) {
        if (!outsideWorld && shouldDetonateProjectile(projectile)) {
          this.detonateProjectile(projectile);
        }
        projectile.state = "expired";
      }
    }
  }

  getMissileBehaviorTargets(projectile) {
    return [...this.tanks.values()]
      .filter((tank) => tank.state === "alive" && tank.id !== projectile.ownerId && !this.isTankInvulnerable(tank));
  }

  detonateProjectile(projectile) {
    if (!projectile || projectile.detonated) {
      return [];
    }
    projectile.detonated = true;
    const sparks = createExplosionSparkProjectiles({
      projectile,
      nextId: (prefix) => this.nextEntityId(prefix),
      nowMs: this.timeMs
    });
    for (const spark of sparks) {
      this.projectiles.set(spark.id, spark);
    }
    this.performanceStats.explosionSparksCreated += sparks.length;
    return sparks;
  }

  resolveProjectileHits() {
    const projectiles = [...this.projectiles.values()].sort((a, b) => a.id.localeCompare(b.id));

    for (const projectile of projectiles) {
      if (projectile.state !== "active") {
        continue;
      }
      if ((projectile.kind === "trap" || projectile.behavior === "trap") && !projectile.armed) {
        continue;
      }

      const trapBlock = this.getTrapProjectileBlockHit(projectile);
      if (trapBlock) {
        if (shouldDetonateProjectile(projectile)) {
          this.detonateProjectile(projectile);
        }
        recordTrapProjectileBlock(trapBlock, projectile, this.timeMs);
        this.performanceStats.trapBlocks += 1;
        continue;
      }

      const candidates = this.getProjectileCollisionCandidates(projectile);
      const liveTanks = candidates
        .filter((candidate) => candidate.type === "tank" && candidate.state === "alive" && !this.isTankInvulnerable(candidate))
        .sort((a, b) => a.id.localeCompare(b.id));
      const liveShapes = candidates
        .filter((candidate) => candidate.type === "shape" && candidate.state === "alive")
        .sort((a, b) => a.id.localeCompare(b.id));
      this.performanceStats.collisionCandidateChecks += liveTanks.length + liveShapes.length;

      const hittableTanks = liveTanks.filter((tank) => canProjectileHitTarget(projectile, tank.id, this.timeMs));
      const hittableShapes = projectile.hitsShapes === false
        ? []
        : liveShapes.filter((shape) => canProjectileHitTarget(projectile, shape.id, this.timeMs));

      const droneHit = getProjectileDroneHit(this, projectile);
      if (droneHit) {
        damageDroneWithProjectile(this, droneHit, projectile);
        if (shouldDetonateProjectile(projectile)) {
          this.detonateProjectile(projectile);
        }
        recordProjectileTargetHit(projectile, droneHit.id, this.timeMs);
        continue;
      }

      const tankHit = getFirstCircleHit(projectile, hittableTanks, projectile.ownerId);
      if (tankHit) {
        this.damageTank(tankHit, projectile);
        if (shouldDetonateProjectile(projectile)) {
          this.detonateProjectile(projectile);
        }
        recordProjectileTargetHit(projectile, tankHit.id, this.timeMs);
        continue;
      }

      const shapeHit = getFirstCircleHit(projectile, hittableShapes);
      if (shapeHit) {
        this.damageShape(shapeHit, projectile);
        if (shouldDetonateProjectile(projectile)) {
          this.detonateProjectile(projectile);
        }
        recordProjectileTargetHit(projectile, shapeHit.id, this.timeMs);
      }
    }
  }

  getTrapProjectileBlockHit(projectile) {
    if (projectile.kind === "trap" || projectile.behavior === "trap") {
      return null;
    }
    const candidates = [];
    for (const trap of this.projectiles.values()) {
      if (trap.id === projectile.id || !canTrapBlockProjectile(trap, projectile, this.timeMs)) {
        continue;
      }
      if (circleIntersects(projectile, trap)) {
        candidates.push(trap);
      }
    }
    return getFirstCircleHit(projectile, candidates);
  }

  resolveContactCollisions(dtSeconds) {
    const config = COMBAT_FEEL_CONFIG.contactCollision;
    if (!config.enabled) {
      return;
    }

    let pairs = 0;
    const seenTankPairs = new Set();
    const tanks = [...this.tanks.values()]
      .filter((tank) => tank.state === "alive")
      .sort((a, b) => a.id.localeCompare(b.id));

    for (const tank of tanks) {
      if (pairs >= config.maxPairsPerTick) {
        break;
      }
      const candidates = this.spatialIndex?.queryCircle
        ? this.spatialIndex.queryCircle(tank.x, tank.y, tank.radius + this.maxCollisionCandidateRadius + 24)
        : [...this.shapes.values(), ...this.tanks.values()];

      for (const candidate of candidates) {
        if (pairs >= config.maxPairsPerTick || candidate.id === tank.id || candidate.state !== "alive") {
          continue;
        }
        if (candidate.type === "shape") {
          if (this.resolveTankShapeContact(tank, candidate, dtSeconds)) {
            pairs += 1;
          }
          continue;
        }
        if (candidate.type === "tank") {
          const key = [tank.id, candidate.id].sort().join("|");
          if (seenTankPairs.has(key)) {
            continue;
          }
          seenTankPairs.add(key);
          if (this.resolveTankTankContact(tank, candidate, dtSeconds)) {
            pairs += 1;
          }
        }
      }
    }
    this.performanceStats.contactPairs += pairs;
  }

  resolveTankShapeContact(tank, shape, dtSeconds) {
    const config = COMBAT_FEEL_CONFIG.contactCollision;
    const resolution = getContactResolution(tank, shape, config.shapePushStrength);
    if (!resolution.colliding) {
      return false;
    }

    tank.x += resolution.pushX;
    tank.y += resolution.pushY;
    pushCircleIntoWorld(tank, this.config.world);

    const tankInvulnerable = this.isTankInvulnerable(tank);
    const canDeal = !tankInvulnerable || config.spawnInvulnerableDealsDamage;
    const canTake = !tankInvulnerable || config.spawnInvulnerableTakesDamage;
    const damage = calculateTankShapeContactDamage({ tank, shape, dtSeconds, config });

    if (canDeal && shape.state === "alive" && damage.tankToShape > 0) {
      this.performanceStats.contactDamage.tankToShape += damage.tankToShape;
      this.damageShape(shape, createContactSource({
        owner: tank,
        target: shape,
        damage: damage.tankToShape,
        nowMs: this.timeMs,
        id: `contact-${tank.id}-${shape.id}`
      }));
    }
    if (canTake && tank.state === "alive" && damage.shapeToTank > 0) {
      this.performanceStats.contactDamage.shapeToTank += damage.shapeToTank;
      this.damageTank(tank, createContactSource({
        owner: shape,
        target: tank,
        damage: damage.shapeToTank,
        nowMs: this.timeMs,
        id: `contact-${shape.id}-${tank.id}`,
        ownerName: shape.isCenterObjective ? "Alpha Pentagon" : shape.eventLabel ?? shape.shapeType
      }));
    }
    return true;
  }

  resolveTankTankContact(tankA, tankB, dtSeconds) {
    const config = COMBAT_FEEL_CONFIG.contactCollision;
    const resolution = getContactResolution(tankA, tankB, config.tankPushStrength);
    if (!resolution.colliding) {
      return false;
    }

    tankA.x += resolution.pushX * 0.5;
    tankA.y += resolution.pushY * 0.5;
    tankB.x -= resolution.pushX * 0.5;
    tankB.y -= resolution.pushY * 0.5;
    pushCircleIntoWorld(tankA, this.config.world);
    pushCircleIntoWorld(tankB, this.config.world);

    const aInvulnerable = this.isTankInvulnerable(tankA);
    const bInvulnerable = this.isTankInvulnerable(tankB);
    if ((!aInvulnerable || config.spawnInvulnerableDealsDamage) && (!bInvulnerable || config.spawnInvulnerableTakesDamage)) {
      const damage = calculateTankTankContactDamage({ source: tankA, target: tankB, dtSeconds, config });
      this.performanceStats.contactDamage.tankToTank += damage;
      this.damageTank(tankB, createContactSource({
        owner: tankA,
        target: tankB,
        damage,
        nowMs: this.timeMs,
        id: `contact-${tankA.id}-${tankB.id}`
      }));
    }
    if (tankB.state === "alive" && (!bInvulnerable || config.spawnInvulnerableDealsDamage) && (!aInvulnerable || config.spawnInvulnerableTakesDamage)) {
      const damage = calculateTankTankContactDamage({ source: tankB, target: tankA, dtSeconds, config });
      this.performanceStats.contactDamage.tankToTank += damage;
      this.damageTank(tankA, createContactSource({
        owner: tankB,
        target: tankA,
        damage,
        nowMs: this.timeMs,
        id: `contact-${tankB.id}-${tankA.id}`
      }));
    }
    return true;
  }

  damageTank(tank, projectile) {
    const appliedDamage = Math.min(tank.hp, projectile.damage);
    tank.hp -= projectile.damage;
    tank.lastDamageAtMs = this.timeMs;
    const damageSource = createDamageSourceInfo({
      source: projectile,
      target: tank,
      amount: appliedDamage,
      timeMs: this.timeMs
    });
    tank.lastDamageSource = damageSource;
    this.queueDamageEvent(tank, damageSource);
    recordBotDamageMemory(this, tank, projectile, appliedDamage);

    if (tank.hp > 0 || tank.state !== "alive") {
      return;
    }

    tank.hp = 0;
    tank.state = "dead";
    tank.respawnAtMs = this.timeMs + this.config.server.respawnDelayMs;
    tank.killerName = damageSource.sourceName;
    tank.input.fire = false;

    const killer = this.tanks.get(projectile.ownerId);
    if (killer && killer.state === "alive" && killer.id !== tank.id) {
      const reward = xpRewardForTankKill(tank, this.config);
      addXp(killer, reward, reward, this.config);
      this.grantCoins(killer, coinsForTankKill(tank, this.appConfig), "tankKill");
      this.recordTankKillForRivals(killer, tank);
      this.claimBotBountyIfEligible(killer, tank);
      refreshClassUnlocks(killer);
      refreshTankStats(killer, this.config);
    }

    const oldClassId = tank.classId;
    const penalty = this.applyTankDeathPenalty(tank);
    this.clearPendingWeaponShots(tank.id);
    this.expireOwnedProjectiles(tank.id);
    cleanupOwnerDrones(this, tank.id);
    if (tank.kind === "bot") {
      clearBotRivalState(tank, this.timeMs);
    }

    if (tank.kind === "player") {
      this.pendingEvents.push({
        type: "death",
        clientId: tank.clientId,
        playerId: tank.id,
        killerName: damageSource.sourceName,
        deathCause: damageSource,
        score: Math.floor(tank.score),
        level: tank.level,
        oldLevel: penalty.oldLevel,
        newLevel: penalty.newLevel,
        oldClassId,
        newClassId: tank.classId,
        scoreLost: penalty.scoreLost,
        deathPenalty: penalty,
        respawnAtMs: tank.respawnAtMs
      });
    }
  }

  queueDamageEvent(tank, damageSource) {
    if (tank.kind !== "player" || !tank.clientId || !damageSource || damageSource.amount <= 0) {
      return false;
    }
    const cause = damageSource.cause;
    if (isContactDamageCause(cause)) {
      tank.lastDamageEventByCauseAtMs ??= {};
      const lastAt = tank.lastDamageEventByCauseAtMs[cause] ?? -Infinity;
      if (this.timeMs - lastAt < COMBAT_FEEDBACK_CONFIG.contactDamageEventGapMs) {
        return false;
      }
      tank.lastDamageEventByCauseAtMs[cause] = this.timeMs;
    }
    this.pendingEvents.push({
      type: "damage",
      clientId: tank.clientId,
      playerId: tank.id,
      ...damageSource
    });
    return true;
  }

  damageShape(shape, projectile) {
    if (!shape || shape.state !== "alive") {
      return;
    }
    const rawDamage = Math.max(0, Number(projectile?.damage) || 0);
    const effectiveDamage = rawDamage * getEventShapeDamageMultiplier(shape);
    const appliedDamage = Math.min(shape.hp, effectiveDamage);
    shape.hp -= effectiveDamage;
    recordObjectiveHit(this, shape, projectile, appliedDamage);
    recordEventShapeHit(this, shape, projectile, appliedDamage);
    if (shape.hp > 0) {
      return;
    }

    shape.state = "dead";
    this.shapes.delete(shape.id);

    if (completeCenterObjectiveIfNeeded(this, shape, projectile)) {
      return;
    }
    if (completeEventShapeIfNeeded(this, shape, projectile)) {
      return;
    }

    const owner = this.tanks.get(projectile.ownerId);
    if (owner) {
      addXp(owner, shape.xp, shape.xp, this.config);
      this.grantCoins(owner, coinsForShape(shape.xp, this.appConfig), "shape");
      refreshClassUnlocks(owner);
      refreshTankStats(owner, this.config);
      handleNecromancerShapeConversion(this, shape, projectile);
    }
  }

  grantCoins(tank, rawCoins, source) {
    if (tank.kind !== "player") {
      return 0;
    }
    const awarded = applyMatchCoinCap(tank.matchCoinsEarned, rawCoins, this.appConfig);
    if (awarded <= 0) {
      return 0;
    }
    tank.matchCoinsRaw += Math.max(0, Math.floor(Number(rawCoins) || 0));
    tank.matchCoinsEarned += awarded;
    if (tank.accountId && this.accountStore) {
      this.accountStore.updateAccount(tank.accountId, (account) => {
        account.coins += awarded;
      });
    }
    this.pendingEvents.push({
      type: "coins",
      playerId: tank.id,
      accountId: tank.accountId,
      amount: awarded,
      source
    });
    return awarded;
  }

  recordTankKillForRivals(killer, victim) {
    if (killer?.kind !== "bot" || !victim || killer.id === victim.id) {
      return null;
    }
    return recordBotRivalKill(killer, victim, this.timeMs);
  }

  claimBotBountyIfEligible(killer, victim) {
    if (victim?.kind !== "bot" || killer?.kind !== "player") {
      return null;
    }
    this.pruneBotBountyClaims();
    const eligibility = canClaimBotBounty({
      bot: victim,
      killer,
      recentClaims: this.botBountyClaims,
      nowMs: this.timeMs
    });
    if (!eligibility.allowed) {
      return null;
    }

    const reward = getBotBountyReward(victim);
    if (reward.coins <= 0 && reward.xp <= 0 && reward.score <= 0) {
      return null;
    }

    markBotBountyClaimed(victim, this.timeMs);
    this.botBountyClaims.push({
      killerId: killer.id,
      botId: victim.id,
      botName: victim.name,
      atMs: this.timeMs
    });
    if (reward.xp > 0 || reward.score > 0) {
      addXp(killer, reward.xp, reward.score, this.config);
    }
    const coinsAwarded = this.grantCoins(killer, reward.coins, "botBounty");
    this.pendingEvents.push({
      type: "botBounty",
      playerId: killer.id,
      targetId: victim.id,
      targetName: victim.name,
      coins: coinsAwarded,
      xp: reward.xp,
      score: reward.score
    });
    return { ...reward, coins: coinsAwarded };
  }

  pruneBotBountyClaims() {
    this.botBountyClaims = pruneBotBountyClaimRecords(this.botBountyClaims, this.timeMs);
  }

  applyTankDeathPenalty(tank) {
    const penalty = applyDeathProgressionPenalty(tank);
    const classBefore = tank.classId;
    const downgrade = downgradeClassForLevel(tank, tank.level);
    refreshClassUnlocks(tank);
    refreshTankStats(tank, this.config);
    tank.hp = 0;
    return {
      ...penalty,
      oldClassId: classBefore,
      newClassId: downgrade.classId
    };
  }

  expireOwnedProjectiles(ownerId) {
    for (const projectile of this.projectiles.values()) {
      if (projectile.ownerId === ownerId) {
        projectile.state = "expired";
      }
    }
  }

  refreshTankCosmetics(tank) {
    if (tank.kind !== "player" || !tank.accountId || !this.accountStore) {
      return;
    }
    const account = this.accountStore.getAccountById(tank.accountId);
    if (!account) {
      return;
    }
    const cosmetics = normalizeAccountCosmetics(account, this.appConfig);
    tank.cosmetics = cosmetics.loadout;
    tank.color = cosmetics.loadout.bodyColor;
  }

  cleanupEntities() {
    for (const [id, projectile] of this.projectiles) {
      if (projectile.state !== "active") {
        this.projectiles.delete(id);
      }
    }

    cleanupInvalidDrones(this);

    for (const [id, tank] of this.tanks) {
      if (
        tank.kind === "player" &&
        tank.disconnectedAtMs !== null &&
        this.timeMs - tank.disconnectedAtMs >= this.config.server.disconnectGraceMs
      ) {
        this.clearPendingWeaponShots(tank.id);
        cleanupOwnerDrones(this, tank.id);
        this.tanks.delete(id);
        this.clientToPlayer.delete(tank.clientId);
      }
    }
  }

  isTankInvulnerable(tank) {
    return this.timeMs - tank.spawnedAtMs < this.config.tank.spawnInvulnerableMs;
  }

  consumeEvents() {
    const events = this.pendingEvents;
    this.pendingEvents = [];
    return events;
  }

  createSnapshot() {
    return {
      tick: this.tick,
      timeMs: Math.round(this.timeMs),
      world: this.config.world,
      tanks: [...this.tanks.values()].map((tank) => ({
        id: tank.id,
        kind: tank.kind,
        name: tank.name,
        x: Math.round(tank.x * 10) / 10,
        y: Math.round(tank.y * 10) / 10,
        vx: Math.round(tank.vx),
        vy: Math.round(tank.vy),
        angle: tank.aimAngle,
        radius: tank.radius,
        color: tank.color,
        cosmetics: tank.cosmetics,
        classId: tank.classId,
        className: getTankClassName(tank.classId),
        classUnlockChoices: getAvailableClassChoices(tank),
        barrelKickRatio: Math.max(0, Math.min(1, ((tank.barrelKickUntilMs ?? 0) - this.timeMs) / COMBAT_FEEL_CONFIG.muzzle.flashMs)),
        recoilX: Math.round((tank.recoilX ?? 0) * 10) / 10,
        recoilY: Math.round((tank.recoilY ?? 0) * 10) / 10,
        fireCooldownMs: Math.round(tank.fireCooldownMs ?? 0),
        lastFireImpulse: tank.lastFireImpulse ?? null,
        droneStatus: getLocalDroneStatus(this, tank),
        hp: Math.round(tank.hp),
        maxHp: Math.round(tank.maxHp),
        level: tank.level,
        xp: Math.floor(tank.xp),
        xpNext: xpForNextLevel(tank.level, this.config),
        score: Math.floor(tank.score),
        matchCoinsEarned: tank.matchCoinsEarned ?? 0,
        accountCoins: this.getAccountCoins(tank),
        upgradePoints: tank.upgradePoints,
        upgrades: tank.upgrades,
        state: tank.state,
        invulnerable: this.isTankInvulnerable(tank),
        lastInputSeq: tank.kind === "player" ? (tank.input?.seq ?? 0) : 0
      })),
      projectiles: [...this.projectiles.values()].map((projectile) => ({
        id: projectile.id,
        ownerId: projectile.ownerId,
        ownerClassId: projectile.ownerClassId ?? null,
        feedbackProfile: projectile.feedbackProfile ?? null,
        kind: projectile.kind ?? "bullet",
        behavior: projectile.behavior ?? "bullet",
        x: Math.round(projectile.x * 10) / 10,
        y: Math.round(projectile.y * 10) / 10,
        prevX: Math.round((projectile.prevX ?? projectile.x) * 10) / 10,
        prevY: Math.round((projectile.prevY ?? projectile.y) * 10) / 10,
        spawnX: Math.round((projectile.spawnX ?? projectile.x) * 10) / 10,
        spawnY: Math.round((projectile.spawnY ?? projectile.y) * 10) / 10,
        radius: projectile.radius,
        angle: projectile.angle,
        armed: projectile.armed !== false,
        fillColor: projectile.fillColor,
        coreColor: projectile.coreColor,
        trailColor: projectile.trailColor,
        trailMs: projectile.trailMs,
        trailAlpha: projectile.trailAlpha,
        outlineColor: projectile.outlineColor,
        outlineWidth: projectile.outlineWidth,
        pulseColor: projectile.pulseColor,
        warningRing: projectile.warningRing,
        impactStyle: projectile.impactStyle,
        createdAtMs: Math.round(projectile.createdAtMs ?? 0),
        ageMs: Math.round(projectile.ageMs ?? 0)
      })),
      drones: getDroneSnapshots(this),
      shapes: [...this.shapes.values()].map((shape) => ({
        id: shape.id,
        shapeType: shape.shapeType,
        x: Math.round(shape.x * 10) / 10,
        y: Math.round(shape.y * 10) / 10,
        radius: shape.radius,
        hp: Math.round(shape.hp),
        maxHp: shape.maxHp,
        sides: shape.sides,
        color: shape.color,
        isCenterObjective: Boolean(shape.isCenterObjective),
        isEventObjective: Boolean(shape.isEventObjective),
        eventObjectiveId: shape.eventObjectiveId ?? null,
        eventType: shape.eventType ?? null,
        eventLabel: shape.eventLabel ?? null,
        eventShortLabel: shape.eventShortLabel ?? null,
        eventThreatLevel: shape.eventThreatLevel ?? 0,
        eventExpiresAtMs: shape.eventExpiresAtMs ?? 0,
        eventRewardXp: shape.eventRewardXp ?? 0,
        eventCoinReward: shape.eventCoinReward ?? 0,
        eventColor: shape.eventColor ?? null,
        eventOutlineColor: shape.eventOutlineColor ?? null,
        eventPulseColor: shape.eventPulseColor ?? null,
        eventMinimapSize: shape.eventMinimapSize ?? 0,
        eventHasDeathBurst: Boolean(shape.eventHasDeathBurst),
        eventDeathBurstWarningMs: shape.eventDeathBurstWarningMs ?? 0,
        xp: shape.xp
      })),
      centerObjective: getCenterObjectiveSnapshot(this),
      eventObjectives: getEventObjectiveSnapshots(this),
      rivals: getBotRivalSnapshots(this.tanks.values(), this.timeMs),
      leaderboard: this.getLeaderboard(),
      counts: {
        tanks: this.tanks.size,
        humans: [...this.tanks.values()].filter((tank) => tank.kind === "player").length,
        bots: [...this.tanks.values()].filter((tank) => tank.kind === "bot").length,
        projectiles: this.projectiles.size,
        drones: this.drones.size,
        shapes: this.shapes.size
      },
      debug: {
        botProfiles: getBotProfileCounts(this),
        classCounts: this.getClassDebugCounts(),
        botClassCounts: getBotClassDebugCounts(this),
        botBehavior: getBotBehaviorDebugCounts(this),
        centerObjective: getCenterObjectiveDebug(this),
        eventObjectives: getEventObjectiveDebug(this),
        botRivals: getBotRivalDebug(this.tanks.values(), this.timeMs, this.botBountyClaims),
        drones: getDroneDebug(this),
        shapeCounts: getShapeTypeCounts(this),
        balanceVersion: "fast-arcade-risk-v2",
        performance: this.getPerformanceDebugState()
      }
    };
  }

  getLeaderboard() {
    return [...this.tanks.values()]
      .sort((a, b) => b.score - a.score || b.level - a.level || a.name.localeCompare(b.name))
      .slice(0, 8)
      .map((tank) => ({
        id: tank.id,
        name: tank.name,
        score: Math.floor(tank.score),
        level: tank.level,
        kind: tank.kind
      }));
  }

  getDebugState() {
    return {
      tick: this.tick,
      timeMs: Math.round(this.timeMs),
      publicConfig: getPublicConfig(this.config, {
        tankClasses: getPublicTankClassConfig(),
        eventObjectives: getPublicEventObjectiveConfig(),
        drones: getPublicDroneConfig()
      }),
      counts: this.createSnapshot().counts,
      leaderboard: this.getLeaderboard(),
      botProfiles: getBotProfileCounts(this),
      classCounts: this.getClassDebugCounts(),
      botClassCounts: getBotClassDebugCounts(this),
      botBehavior: getBotBehaviorDebugCounts(this),
      centerObjective: getCenterObjectiveDebug(this),
      eventObjectives: getEventObjectiveDebug(this),
      botRivals: getBotRivalDebug(this.tanks.values(), this.timeMs, this.botBountyClaims),
      drones: getDroneDebug(this),
      shapeCounts: getShapeTypeCounts(this),
      balanceVersion: "fast-arcade-risk-v2",
      performance: this.getPerformanceDebugState()
    };
  }

  rebuildSpatialIndex() {
    const entities = [
      ...[...this.tanks.values()].filter((tank) => tank.state === "alive"),
      ...[...this.shapes.values()].filter((shape) => shape.state === "alive")
    ];
    this.spatialIndex = buildSpatialHash(entities, {
      cellSize: this.config.performance.spatialHashCellSize
    });
    const stats = this.spatialIndex.getStats();
    this.performanceStats.spatialCells = stats.cells;
    this.performanceStats.spatialInserted = stats.inserted;
  }

  getProjectileCollisionCandidates(projectile) {
    if (!this.spatialIndex) {
      return [...this.tanks.values(), ...this.shapes.values()];
    }
    const padding = this.config.performance?.projectileCollisionPadding ?? 32;
    const radius = projectile.radius + this.maxCollisionCandidateRadius + padding;
    const candidates = this.spatialIndex.queryCircle(projectile.x, projectile.y, radius);
    this.performanceStats.projectileSpatialQueries += 1;
    return candidates;
  }

  resetPerformanceStats() {
    this.performanceStats = createPerformanceStats(this.config);
  }

  getPerformanceDebugState() {
    return {
      spatialCells: this.performanceStats.spatialCells,
      spatialInserted: this.performanceStats.spatialInserted,
      aiCandidateChecks: this.performanceStats.aiCandidateChecks,
      projectileSpatialQueries: this.performanceStats.projectileSpatialQueries,
      collisionCandidateChecks: this.performanceStats.collisionCandidateChecks
      ,
      contactPairs: this.performanceStats.contactPairs,
      contactDamage: this.performanceStats.contactDamage,
      droneContact: this.performanceStats.droneContact,
      explosionSparksCreated: this.performanceStats.explosionSparksCreated,
      trapBlocks: this.performanceStats.trapBlocks,
      projectileKinds: getProjectileKindCounts(this.projectiles)
    };
  }

  getBotProfileDebugState() {
    return getBotProfileCounts(this);
  }

  getClassDebugCounts() {
    const counts = {};
    for (const tank of this.tanks.values()) {
      const classId = tank.classId ?? "basic";
      counts[classId] = (counts[classId] ?? 0) + 1;
    }
    return counts;
  }

  getBotClassDebugState() {
    return getBotClassDebugCounts(this);
  }

  getBotBehaviorDebugState() {
    return getBotBehaviorDebugCounts(this);
  }

  getCenterObjectiveDebugState() {
    return getCenterObjectiveDebug(this);
  }

  getEventObjectiveDebugState() {
    return getEventObjectiveDebug(this);
  }

  getShapeTypeDebugState() {
    return getShapeTypeCounts(this);
  }

  getAccountCoins(tank) {
    if (!tank.accountId || !this.accountStore) {
      return null;
    }
    const account = this.accountStore.getAccountById(tank.accountId);
    return account ? Math.floor(account.coins) : null;
  }
}

function createPerformanceStats(config) {
  return {
    spatialCellSize: config.performance?.spatialHashCellSize ?? 360,
    spatialCells: 0,
    spatialInserted: 0,
    aiCandidateChecks: 0,
    projectileSpatialQueries: 0,
    collisionCandidateChecks: 0,
    contactPairs: 0,
    contactDamage: {
      tankToShape: 0,
      shapeToTank: 0,
      tankToTank: 0
    },
    droneContact: {
      pairs: 0
    },
    explosionSparksCreated: 0,
    trapBlocks: 0
  };
}

function createContactSource({ owner, target, damage, nowMs, id, ownerName = owner?.name }) {
  return {
    id,
    type: "contact",
    kind: "contact",
    behavior: "contact",
    ownerId: owner?.id ?? "world",
    ownerName: ownerName ?? "world",
    ownerKind: owner?.kind ?? owner?.type ?? "world",
    ownerShapeType: owner?.shapeType ?? null,
    ownerIsCenterObjective: Boolean(owner?.isCenterObjective),
    x: target?.x ?? owner?.x ?? 0,
    y: target?.y ?? owner?.y ?? 0,
    prevX: target?.x ?? owner?.x ?? 0,
    prevY: target?.y ?? owner?.y ?? 0,
    radius: 0,
    damage: Math.max(0, Number(damage) || 0),
    ageMs: 0,
    ttlMs: 0,
    createdAtMs: nowMs,
    state: "active"
  };
}

function getLoadoutForAccount(account) {
  if (!account) {
    return null;
  }
  return account.loadout ?? normalizeAccountCosmetics(account).loadout;
}
