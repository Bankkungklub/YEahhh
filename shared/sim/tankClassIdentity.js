import {
  TANK_CLASS_FEEDBACK_PROFILES,
  TANK_CLASS_IDENTITY_CONFIG,
  TANK_CLASS_IDENTITY_LIMITS
} from "../config/tankClassIdentityConfig.js";
import { TANK_CLASS_CONFIG } from "../config/tankClassConfig.js";

const PROFILE_SET = new Set(TANK_CLASS_FEEDBACK_PROFILES);

const REQUIRED_PROFILE_BY_CLASS = Object.freeze({
  overseer: "drone",
  overlord: "drone",
  necromancer: "drone",
  hiveLord: "drone",
  trapper: "trap",
  minefield: "trap",
  aegisBastion: "trap",
  missileCommand: "missile",
  stormcaller: "storm",
  siegeCore: "heavy",
  comet: "booster",
  streamliner: "rapid"
});

export function getTankClassIdentity(classId, identityConfig = TANK_CLASS_IDENTITY_CONFIG) {
  return identityConfig[classId] ?? null;
}

export function getClassChoiceIdentityViewModel(classId, identityConfig = TANK_CLASS_IDENTITY_CONFIG) {
  const identity = getTankClassIdentity(classId, identityConfig);
  if (!identity) {
    return {
      roleLabel: "Unknown",
      weaponLine: "Class identity unavailable.",
      strengthLine: "",
      weaknessLine: "",
      feedbackProfile: "standard",
      feelTags: []
    };
  }
  return {
    roleLabel: identity.roleLabel,
    weaponLine: identity.weaponLine,
    strengthLine: identity.strengthLine,
    weaknessLine: identity.weaknessLine,
    feedbackProfile: identity.feedbackProfile,
    feelTags: [...identity.feelTags]
  };
}

export function getProjectileFeedbackProfile(projectileOrClassId, identityConfig = TANK_CLASS_IDENTITY_CONFIG) {
  const classId = typeof projectileOrClassId === "string"
    ? projectileOrClassId
    : projectileOrClassId?.ownerClassId ?? projectileOrClassId?.classId;
  const profile = getTankClassIdentity(classId, identityConfig)?.feedbackProfile;
  if (PROFILE_SET.has(profile)) {
    return profile;
  }
  const behavior = typeof projectileOrClassId === "object" ? projectileOrClassId?.behavior : null;
  const kind = typeof projectileOrClassId === "object" ? projectileOrClassId?.kind : null;
  if (PROFILE_SET.has(behavior)) {
    return behavior;
  }
  if (kind === "rocket") {
    return "rocket";
  }
  if (kind === "trap") {
    return "trap";
  }
  return "standard";
}

export function getTankClassIdentitySummary(classId, {
  tankClassConfig = TANK_CLASS_CONFIG,
  identityConfig = TANK_CLASS_IDENTITY_CONFIG
} = {}) {
  const tankClass = tankClassConfig.classes[classId] ?? null;
  const identity = getTankClassIdentity(classId, identityConfig);
  if (!tankClass || !identity) {
    return null;
  }
  return {
    classId,
    name: tankClass.name,
    unlockLevel: tankClass.unlockLevel,
    weaponPattern: tankClass.weaponPattern,
    droneLoadoutId: tankClass.droneLoadoutId ?? null,
    roleLabel: identity.roleLabel,
    feedbackProfile: identity.feedbackProfile,
    feelTags: [...identity.feelTags]
  };
}

export function validateTankClassIdentityConfig({
  tankClassConfig = TANK_CLASS_CONFIG,
  identityConfig = TANK_CLASS_IDENTITY_CONFIG,
  limits = TANK_CLASS_IDENTITY_LIMITS
} = {}) {
  const issues = [];
  const classIds = Object.keys(tankClassConfig.classes ?? {});

  for (const classId of classIds) {
    const tankClass = tankClassConfig.classes[classId];
    if (!tankClass?.active) {
      continue;
    }
    const identity = identityConfig[classId];
    if (!identity) {
      issues.push(`Missing identity metadata for ${classId}.`);
      continue;
    }
    for (const key of ["roleLabel", "weaponLine", "strengthLine", "weaknessLine"]) {
      const value = identity[key];
      if (typeof value !== "string" || value.trim().length === 0) {
        issues.push(`${classId}.${key} must be a non-empty string.`);
        continue;
      }
      if (value.length > limits[key]) {
        issues.push(`${classId}.${key} exceeds ${limits[key]} characters.`);
      }
    }
    if (!Array.isArray(identity.feelTags) || identity.feelTags.length === 0) {
      issues.push(`${classId}.feelTags must be a non-empty array.`);
    }
    if (!PROFILE_SET.has(identity.feedbackProfile)) {
      issues.push(`${classId}.feedbackProfile ${identity.feedbackProfile} is unknown.`);
    }
    const required = REQUIRED_PROFILE_BY_CLASS[classId];
    if (required && identity.feedbackProfile !== required) {
      issues.push(`${classId} must use ${required} feedback profile.`);
    }
    if (tankClass.droneLoadoutId && identity.feedbackProfile !== "drone") {
      issues.push(`${classId} has a drone loadout but does not use drone feedback.`);
    }
    if (!tankClass.droneLoadoutId && tankClass.weaponPattern === "none") {
      issues.push(`${classId} uses no-shot weapon pattern without drone identity.`);
    }
  }

  for (const classId of Object.keys(identityConfig ?? {})) {
    if (!tankClassConfig.classes?.[classId]) {
      issues.push(`Identity metadata references unknown class ${classId}.`);
    }
  }

  return issues;
}
