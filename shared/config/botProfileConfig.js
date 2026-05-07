const config = {
  defaultProfileId: "rookie",
  rivals: {
    enabled: true,
    minLevel: 15,
    rivalKillStreak: 1,
    threatScoreThreshold: 1400,
    bountyKillStreak: 2,
    bountyScoreThreshold: 2600,
    snapshotLimit: 6,
    alertRange: 1400,
    alertLowHpRatio: 0.35,
    revenge: {
      memoryMs: 9000,
      targetScoreBonus: 0.32
    },
    bounty: {
      minCoins: 4,
      maxCoins: 18,
      minXp: 90,
      maxXp: 420,
      minScore: 140,
      maxScore: 520,
      claimWindowMs: 90000,
      maxClaimsPerWindow: 2
    }
  },
  profiles: [
    {
      id: "rookie",
      label: "Rookie",
      weight: 0.4,
      reactionMs: 420,
      aimJitterRadians: 0.34,
      aggression: 0.35,
      farmBias: 0.95,
      retreatHpRatio: 0.5,
      strafeStrength: 0.15,
      fireDiscipline: 0.46,
      aggroRangeMultiplier: 0.75,
      preferredRangeMultiplier: 0.8,
      memoryMs: 1200,
      targetCommitMs: 700,
      targetSwitchHysteresis: 0.55,
      revengeBias: 0.15,
      greedBias: 0.25,
      panicDamageRatio: 0.22,
      panicMs: 900,
      mistakeChance: 0.22,
      aimLeadStrength: 0.2,
      humanFocusBias: 0.8,
      alphaContestBias: 0.25,
      eventBias: 0.2,
      classPreference: ["flankGuard", "rammer", "spike", "twinFlank", "tripleTwin", "triAngle", "booster", "twin", "quadTank", "octoTank"],
      upgradePriority: ["maxHealth", "moveSpeed", "regen", "bulletDamage", "reload", "bulletSpeed"]
    },
    {
      id: "farmer",
      label: "Farmer",
      weight: 0.22,
      reactionMs: 270,
      aimJitterRadians: 0.18,
      aggression: 0.2,
      farmBias: 1.85,
      retreatHpRatio: 0.38,
      strafeStrength: 0.2,
      fireDiscipline: 0.65,
      aggroRangeMultiplier: 0.65,
      preferredRangeMultiplier: 0.9,
      memoryMs: 1800,
      targetCommitMs: 1100,
      targetSwitchHysteresis: 0.8,
      revengeBias: 0.25,
      greedBias: 0.9,
      panicDamageRatio: 0.28,
      panicMs: 650,
      mistakeChance: 0.12,
      aimLeadStrength: 0.45,
      humanFocusBias: 0.75,
      alphaContestBias: 0.8,
      eventBias: 0.95,
      classPreference: ["machineGun", "fireworkTank", "starburst", "gunner", "sprayer", "autoGunner", "twin", "tripleShot", "pentaShot"],
      upgradePriority: ["reload", "bulletDamage", "moveSpeed", "maxHealth", "regen", "bulletSpeed"]
    },
    {
      id: "duelist",
      label: "Duelist",
      weight: 0.18,
      reactionMs: 160,
      aimJitterRadians: 0.09,
      aggression: 0.88,
      farmBias: 0.55,
      retreatHpRatio: 0.3,
      strafeStrength: 0.58,
      fireDiscipline: 0.78,
      aggroRangeMultiplier: 1,
      preferredRangeMultiplier: 1,
      memoryMs: 2600,
      targetCommitMs: 1500,
      targetSwitchHysteresis: 1.15,
      revengeBias: 0.75,
      greedBias: 0.55,
      panicDamageRatio: 0.38,
      panicMs: 450,
      mistakeChance: 0.08,
      aimLeadStrength: 0.75,
      humanFocusBias: 1.2,
      alphaContestBias: 0.55,
      eventBias: 0.55,
      classPreference: ["twin", "tripleShot", "triplet", "flankGuard", "triAngle", "fighter", "rammer", "spike", "machineGun", "destroyer", "hybrid"],
      upgradePriority: ["bulletDamage", "reload", "moveSpeed", "bulletSpeed", "maxHealth", "regen"]
    },
    {
      id: "sniper",
      label: "Sniper",
      weight: 0.1,
      reactionMs: 210,
      aimJitterRadians: 0.045,
      aggression: 0.7,
      farmBias: 0.45,
      retreatHpRatio: 0.34,
      strafeStrength: 0.35,
      fireDiscipline: 0.92,
      aggroRangeMultiplier: 1.25,
      preferredRangeMultiplier: 1.7,
      memoryMs: 3200,
      targetCommitMs: 1700,
      targetSwitchHysteresis: 1.25,
      revengeBias: 0.4,
      greedBias: 0.35,
      panicDamageRatio: 0.34,
      panicMs: 520,
      mistakeChance: 0.07,
      aimLeadStrength: 0.9,
      humanFocusBias: 1,
      alphaContestBias: 0.45,
      eventBias: 0.35,
      classPreference: ["sniper", "hunter", "predator", "streamliner", "trapper", "minefield", "assassin", "stalker"],
      upgradePriority: ["bulletSpeed", "bulletDamage", "reload", "moveSpeed", "maxHealth", "regen"]
    },
    {
      id: "pro",
      label: "Pro",
      weight: 0.1,
      reactionMs: 115,
      aimJitterRadians: 0.035,
      aggression: 1,
      farmBias: 0.35,
      retreatHpRatio: 0.22,
      strafeStrength: 0.75,
      fireDiscipline: 0.93,
      aggroRangeMultiplier: 1.15,
      preferredRangeMultiplier: 1.05,
      memoryMs: 4200,
      targetCommitMs: 1800,
      targetSwitchHysteresis: 1.4,
      revengeBias: 0.65,
      greedBias: 0.7,
      panicDamageRatio: 0.5,
      panicMs: 280,
      mistakeChance: 0.04,
      aimLeadStrength: 0.95,
      humanFocusBias: 1.1,
      alphaContestBias: 0.7,
      eventBias: 0.8,
      classPreference: ["twin", "tripleShot", "triplet", "sniper", "hunter", "predator", "trapper", "minefield", "assassin", "overlord", "machineGun", "fireworkTank", "starburst", "gunner", "autoGunner", "flankGuard", "rammer", "spike"],
      upgradePriority: ["reload", "bulletDamage", "moveSpeed", "bulletSpeed", "maxHealth", "regen"]
    }
  ]
};

export const BOT_PROFILE_CONFIG = deepFreeze(config);

export function validateBotProfileConfig(configToValidate = BOT_PROFILE_CONFIG) {
  const issues = [];
  const ids = new Set();
  let weightSum = 0;

  for (const profile of configToValidate.profiles) {
    if (!profile.id || ids.has(profile.id)) {
      issues.push(`Invalid or duplicate bot profile id: ${profile.id}`);
    }
    ids.add(profile.id);
    weightSum += Number(profile.weight) || 0;

    for (const key of [
      "reactionMs",
      "aimJitterRadians",
      "aggression",
      "farmBias",
      "retreatHpRatio",
      "strafeStrength",
      "fireDiscipline",
      "aggroRangeMultiplier",
      "preferredRangeMultiplier",
      "memoryMs",
      "targetCommitMs",
      "targetSwitchHysteresis",
      "revengeBias",
      "greedBias",
      "panicDamageRatio",
      "panicMs",
      "mistakeChance",
      "aimLeadStrength",
      "humanFocusBias",
      "alphaContestBias",
      "eventBias"
    ]) {
      if (!Number.isFinite(Number(profile[key])) || Number(profile[key]) < 0) {
        issues.push(`Bot profile ${profile.id} has invalid ${key}.`);
      }
    }
    if (!Array.isArray(profile.classPreference) || profile.classPreference.length === 0) {
      issues.push(`Bot profile ${profile.id} needs at least one class preference.`);
    }
    if (!Array.isArray(profile.upgradePriority) || profile.upgradePriority.length === 0) {
      issues.push(`Bot profile ${profile.id} needs at least one upgrade priority.`);
    }
  }

  if (!ids.has(configToValidate.defaultProfileId)) {
    issues.push("Default bot profile id must exist.");
  }
  if (Math.abs(weightSum - 1) > 0.0001) {
    issues.push(`Bot profile weights must sum to 1.0, got ${weightSum}.`);
  }
  issues.push(...validateRivalConfig(configToValidate.rivals));
  return issues;
}

function validateRivalConfig(rivals) {
  const issues = [];
  if (!rivals || typeof rivals !== "object") {
    return ["Bot rival config is required."];
  }
  for (const key of [
    "minLevel",
    "rivalKillStreak",
    "threatScoreThreshold",
    "bountyKillStreak",
    "bountyScoreThreshold",
    "snapshotLimit",
    "alertRange",
    "alertLowHpRatio"
  ]) {
    if (!Number.isFinite(Number(rivals[key])) || Number(rivals[key]) < 0) {
      issues.push(`Bot rival config has invalid ${key}.`);
    }
  }
  if (Number(rivals.bountyKillStreak) < Number(rivals.rivalKillStreak)) {
    issues.push("Bot bounty kill streak must be at least rival kill streak.");
  }
  if (Number(rivals.bountyScoreThreshold) < Number(rivals.threatScoreThreshold)) {
    issues.push("Bot bounty score threshold must be at least threat score threshold.");
  }
  if (rivals.alertLowHpRatio > 1) {
    issues.push("Bot rival low HP ratio must be 0..1.");
  }
  const revenge = rivals.revenge ?? {};
  for (const key of ["memoryMs", "targetScoreBonus"]) {
    if (!Number.isFinite(Number(revenge[key])) || Number(revenge[key]) < 0) {
      issues.push(`Bot rival revenge config has invalid ${key}.`);
    }
  }
  const bounty = rivals.bounty ?? {};
  for (const key of [
    "minCoins",
    "maxCoins",
    "minXp",
    "maxXp",
    "minScore",
    "maxScore",
    "claimWindowMs",
    "maxClaimsPerWindow"
  ]) {
    if (!Number.isFinite(Number(bounty[key])) || Number(bounty[key]) < 0) {
      issues.push(`Bot bounty config has invalid ${key}.`);
    }
  }
  if (Number(bounty.maxCoins) < Number(bounty.minCoins)) {
    issues.push("Bot bounty max coins must be at least min coins.");
  }
  if (Number(bounty.maxXp) < Number(bounty.minXp)) {
    issues.push("Bot bounty max XP must be at least min XP.");
  }
  if (Number(bounty.maxScore) < Number(bounty.minScore)) {
    issues.push("Bot bounty max score must be at least min score.");
  }
  return issues;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}
