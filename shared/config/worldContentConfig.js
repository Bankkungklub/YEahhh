const config = {
  version: "world-alpha-v1",
  centerObjective: {
    enabled: true,
    shapeType: "alphaPentagon",
    xRatio: 0.5,
    yRatio: 0.5,
    radius: 115,
    hp: 1400,
    xp: 4200,
    score: 4200,
    coinReward: 80,
    respawnMs: 45000,
    spawnExclusionRadius: 760,
    normalShapeExclusionRadius: 620,
    contributionMinShare: 0.05,
    sharedRewardRatio: 0.85,
    lastHitBonusRatio: 0.15,
    botTargetWeight: {
      rookie: 0.25,
      farmer: 0.75,
      duelist: 0.45,
      sniper: 0.35,
      pro: 0.65
    },
    ui: {
      showHudPill: true,
      showMinimapMarker: true,
      nearbyHintDistance: 1400,
      label: "ALPHA PENTAGON",
      rewardLabel: "+4200 XP shared"
    }
  }
};

export const WORLD_CONTENT_CONFIG = deepFreeze(config);

export function getPublicWorldContentConfig(content = WORLD_CONTENT_CONFIG) {
  return {
    version: content.version,
    centerObjective: {
      enabled: content.centerObjective.enabled,
      shapeType: content.centerObjective.shapeType,
      xRatio: content.centerObjective.xRatio,
      yRatio: content.centerObjective.yRatio,
      radius: content.centerObjective.radius,
      xp: content.centerObjective.xp,
      respawnMs: content.centerObjective.respawnMs,
      ui: content.centerObjective.ui
    }
  };
}

export function validateWorldContentConfig(content = WORLD_CONTENT_CONFIG) {
  const issues = [];
  const objective = content.centerObjective;
  if (!content.version) {
    issues.push("world content version is required.");
  }
  if (!objective.shapeType) {
    issues.push("centerObjective.shapeType is required.");
  }
  for (const key of ["xRatio", "yRatio"]) {
    const value = objective[key];
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      issues.push(`centerObjective.${key} must be between 0 and 1.`);
    }
  }
  for (const key of ["radius", "hp", "xp", "score", "coinReward", "respawnMs"]) {
    if (!Number.isFinite(objective[key]) || objective[key] <= 0) {
      issues.push(`centerObjective.${key} must be positive.`);
    }
  }
  if (objective.spawnExclusionRadius <= objective.radius) {
    issues.push("centerObjective.spawnExclusionRadius must be larger than radius.");
  }
  if (objective.normalShapeExclusionRadius <= objective.radius) {
    issues.push("centerObjective.normalShapeExclusionRadius must be larger than radius.");
  }
  const rewardRatio = objective.sharedRewardRatio + objective.lastHitBonusRatio;
  if (Math.abs(rewardRatio - 1) > 0.001) {
    issues.push("centerObjective reward ratios must sum to 1.");
  }
  if (objective.contributionMinShare < 0 || objective.contributionMinShare > 1) {
    issues.push("centerObjective.contributionMinShare must be between 0 and 1.");
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
