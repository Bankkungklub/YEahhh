export const COMBAT_FEEDBACK_CONFIG = Object.freeze({
  damageIndicatorTtlMs: 650,
  damageToastTtlMs: 900,
  damageToastMinHpRatio: 0.18,
  contactDamageEventGapMs: 120,
  maxDamageIndicators: 6,
  causes: Object.freeze({
    bullet: { label: "bullet", color: "#ffe75c" },
    rocket: { label: "rocket", color: "#ff8c42" },
    spark: { label: "spark burst", color: "#f25f4c" },
    trap: { label: "trap", color: "#7f5af0" },
    drone: { label: "drone", color: "#b8f28e" },
    tankContact: { label: "body collision", color: "#ff8ba7" },
    shapeContact: { label: "shape collision", color: "#3da9fc" },
    alphaContact: { label: "Alpha collision", color: "#d6bcfa" },
    unknown: { label: "damage", color: "#ffffff" }
  })
});

export function getCombatCauseConfig(cause, config = COMBAT_FEEDBACK_CONFIG) {
  return config.causes[cause] ?? config.causes.unknown;
}
