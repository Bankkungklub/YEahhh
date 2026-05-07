import { COMBAT_FEEL_CONFIG } from "../config/combatFeelConfig.js";
import { DRONE_CONFIG } from "../config/droneConfig.js";
import { TANK_CLASS_CONFIG } from "../config/tankClassConfig.js";
import { getClassChoiceIdentityViewModel } from "./tankClassIdentity.js";

const FACT_LIMITS = Object.freeze({
  minFactsPerClass: 2,
  maxFactsPerClass: 4,
  maxChipLength: 18
});

const RAPID_CADENCE_CLASSES = Object.freeze({
  gunner: 84,
  autoGunner: 96,
  sprayer: 120,
  streamliner: 180
});

export function getTankWeaponFacts(classId, {
  tankClassConfig = TANK_CLASS_CONFIG,
  droneConfig = DRONE_CONFIG,
  combatConfig = COMBAT_FEEL_CONFIG
} = {}) {
  const tankClass = getTankClassNode(classId, tankClassConfig);
  const identity = getClassChoiceIdentityViewModel(classId);
  const profile = identity.feedbackProfile ?? "standard";
  const pattern = getWeaponPatternForClass(classId, tankClassConfig);
  const cadence = getWeaponPatternCadenceSummary(pattern);
  const primaryKind = getPrimaryProjectileKind(pattern);
  const primaryBehavior = getPrimaryProjectileBehavior(pattern);
  const loadout = tankClass?.droneLoadoutId
    ? getDroneLoadoutForClass(tankClass.droneLoadoutId, droneConfig)
    : null;
  const missileConfig = combatConfig.projectileBehaviors?.missile ?? {};
  const trapConfig = combatConfig.projectileBehaviors?.trap ?? {};

  const facts = [];
  if (loadout) {
    addFact(facts, `drone ${loadout.maxDrones}`);
    addFact(facts, `base ${loadout.baseDrones}`);
    if (hasConversionRules(loadout)) {
      addFact(facts, "shape convert");
    }
    addFact(facts, `${Math.round(loadout.rebuildMs)}ms rebuild`);
  } else if (pattern.length > 0) {
    addProjectileFacts(facts, {
      classId,
      profile,
      pattern,
      cadence,
      primaryKind,
      primaryBehavior,
      missileConfig,
      trapConfig
    });
  } else {
    addFact(facts, "no bullets");
    addFact(facts, "command");
  }

  addProfileFallbackFacts(facts, { classId, profile, cadence, primaryKind });

  return {
    classId,
    profile,
    shotCount: cadence.shotCount,
    burstWindowMs: cadence.burstWindowMs,
    spreadWidthRadians: cadence.spreadWidthRadians,
    primaryKind,
    primaryBehavior,
    hasDrones: Boolean(loadout),
    droneCap: loadout?.maxDrones ?? 0,
    hasTrapBlocking: primaryKind === "trap" && trapConfig.blocksProjectiles === true,
    missileSteerMs: primaryBehavior === "missile" ? Number(missileConfig.maxSteerMs ?? 0) : 0,
    damageSum: cadence.damageSum,
    facts: facts.slice(0, FACT_LIMITS.maxFactsPerClass)
  };
}

export function getTankWeaponFactChips(classId, options = {}) {
  return getTankWeaponFacts(classId, options).facts;
}

export function validateTankWeaponFacts({
  tankClassConfig = TANK_CLASS_CONFIG,
  droneConfig = DRONE_CONFIG,
  combatConfig = COMBAT_FEEL_CONFIG,
  limits = FACT_LIMITS
} = {}) {
  const issues = [];
  for (const tankClass of Object.values(tankClassConfig.classes ?? {})) {
    if (!tankClass?.active) {
      continue;
    }
    const facts = getTankWeaponFacts(tankClass.id, { tankClassConfig, droneConfig, combatConfig });
    if (facts.facts.length < limits.minFactsPerClass) {
      issues.push(`${tankClass.id} needs at least ${limits.minFactsPerClass} weapon fact chips.`);
    }
    for (const chip of facts.facts) {
      if (typeof chip !== "string" || chip.trim().length === 0) {
        issues.push(`${tankClass.id} has an empty weapon fact chip.`);
      } else if (chip.length > limits.maxChipLength) {
        issues.push(`${tankClass.id} fact chip "${chip}" exceeds ${limits.maxChipLength} characters.`);
      }
    }
    const expectedWindow = RAPID_CADENCE_CLASSES[tankClass.id];
    if (expectedWindow !== undefined && facts.burstWindowMs !== expectedWindow) {
      issues.push(`${tankClass.id} should have ${expectedWindow}ms rapid cadence, got ${facts.burstWindowMs}ms.`);
    }
    if (tankClass.droneLoadoutId && (!facts.hasDrones || !facts.facts.some((chip) => chip.startsWith("drone ")))) {
      issues.push(`${tankClass.id} has a drone loadout but no drone cap fact.`);
    }
    if (facts.profile === "trap" && !facts.facts.includes("trap blocks")) {
      issues.push(`${tankClass.id} uses trap profile but lacks trap blocking fact.`);
    }
    if (tankClass.id === "missileCommand" && !facts.facts.includes("850ms steer")) {
      issues.push("missileCommand must expose its limited steering window.");
    }
    if (tankClass.id === "siegeCore" && !facts.facts.includes("heavy shell")) {
      issues.push("siegeCore must expose heavy shell identity.");
    }
    if (tankClass.id === "hybrid" && !facts.facts.includes("shell escort")) {
      issues.push("hybrid must be documented as shell escort, not true drone Hybrid.");
    }
  }
  return issues;
}

export function getWeaponPatternCadenceSummary(pattern = []) {
  const shots = Array.isArray(pattern) ? pattern : [];
  const delays = shots.map((shot) => Number(shot.delayMs ?? 0)).filter(Number.isFinite);
  const angles = shots.map((shot) => Number(shot.angleOffset ?? 0)).filter(Number.isFinite);
  const minDelay = delays.length > 0 ? Math.min(...delays) : 0;
  const maxDelay = delays.length > 0 ? Math.max(...delays) : 0;
  const minAngle = angles.length > 0 ? Math.min(...angles) : 0;
  const maxAngle = angles.length > 0 ? Math.max(...angles) : 0;
  const shotCount = shots.length;
  return {
    shotCount,
    burstWindowMs: Math.round(maxDelay - minDelay),
    spreadWidthRadians: roundTo(maxAngle - minAngle, 3),
    forwardShotRatio: shotCount > 0
      ? shots.filter((shot) => Math.abs(Number(shot.angleOffset ?? 0)) <= 0.55).length / shotCount
      : 0,
    damageSum: roundTo(shots.reduce((sum, shot) => sum + Number(shot.damageMultiplier ?? 0), 0), 3)
  };
}

export function getPrimaryProjectileKind(pattern = []) {
  return getMostCommon(pattern.map((shot) => shot.kind ?? "bullet")) ?? "none";
}

export function getPrimaryProjectileBehavior(pattern = []) {
  return getMostCommon(pattern.map((shot) => shot.behavior ?? shot.kind ?? "bullet")) ?? "none";
}

function addProjectileFacts(facts, {
  classId,
  profile,
  pattern,
  cadence,
  primaryKind,
  primaryBehavior,
  missileConfig,
  trapConfig
}) {
  if (primaryKind === "trap") {
    addFact(facts, `${cadence.shotCount} ${cadence.shotCount === 1 ? "trap" : "traps"}`);
    if (trapConfig.blocksProjectiles) {
      addFact(facts, "trap blocks");
    }
    return;
  }
  if (primaryBehavior === "missile") {
    addFact(facts, `${cadence.shotCount} missiles`);
    addFact(facts, `${Math.round(missileConfig.maxSteerMs ?? 0)}ms steer`);
    return;
  }
  if (primaryKind === "rocket") {
    addFact(facts, `${cadence.shotCount} rocket`);
    addFact(facts, "spark burst");
    return;
  }

  addFact(facts, `${cadence.shotCount} ${cadence.shotCount === 1 ? "shot" : "shots"}`);
  if (cadence.burstWindowMs > 0) {
    addFact(facts, `${cadence.burstWindowMs}ms ${isSprayProfile(profile) ? "spray" : "burst"}`);
  }
  if (classId === "hybrid") {
    addFact(facts, "shell escort");
  }
  if (profile === "heavy") {
    addFact(facts, "heavy shell");
  }
  if (profile === "precision") {
    addFact(facts, "long range");
  }
  if (profile === "booster") {
    addFact(facts, "boost recoil");
  }
  if (profile === "body") {
    addFact(facts, "body damage");
  }
  if (cadence.spreadWidthRadians >= 0.65) {
    addFact(facts, "wide fan");
  } else if (cadence.forwardShotRatio >= 0.8 && cadence.shotCount > 1) {
    addFact(facts, "forward focus");
  }
}

function addProfileFallbackFacts(facts, { classId, profile, cadence, primaryKind }) {
  if (facts.length >= FACT_LIMITS.minFactsPerClass) {
    return;
  }
  if (profile === "rapid") {
    addFact(facts, "rapid fire");
  }
  if (profile === "spread") {
    addFact(facts, cadence.spreadWidthRadians >= 0.65 ? "wide fan" : "lane cover");
  }
  if (profile === "standard") {
    addFact(facts, "steady fire");
  }
  if (primaryKind === "bullet" && cadence.shotCount === 1 && classId !== "basic") {
    addFact(facts, "focused");
  }
  addFact(facts, "config true");
}

function addFact(facts, value) {
  const chip = String(value ?? "").trim();
  if (!chip || chip.length > FACT_LIMITS.maxChipLength || facts.includes(chip)) {
    return false;
  }
  facts.push(chip);
  return true;
}

function getTankClassNode(classId, tankClassConfig) {
  return tankClassConfig.classes?.[classId] ?? TANK_CLASS_CONFIG.classes[classId] ?? null;
}

function getWeaponPatternForClass(classId, tankClassConfig) {
  const tankClass = getTankClassNode(classId, tankClassConfig);
  if (!tankClass || tankClass.weaponPattern === "none") {
    return [];
  }
  return tankClassConfig.weaponPatterns?.[tankClass.weaponPattern]
    ?? TANK_CLASS_CONFIG.weaponPatterns?.[tankClass.weaponPattern]
    ?? [];
}

function getDroneLoadoutForClass(loadoutId, droneConfig) {
  return droneConfig.loadouts?.[loadoutId] ?? DRONE_CONFIG.loadouts?.[loadoutId] ?? null;
}

function hasConversionRules(loadout) {
  return Object.keys(loadout?.conversionRules ?? {}).length > 0;
}

function isSprayProfile(profile) {
  return ["rapid", "spread", "storm"].includes(profile);
}

function getMostCommon(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best = null;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}
