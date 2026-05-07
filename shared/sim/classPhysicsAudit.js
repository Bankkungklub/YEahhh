import { GAME_CONFIG, getTankStats } from "../config/gameConfig.js";
import { TANK_CLASS_CONFIG } from "../config/tankClassConfig.js";
import { getClassAdjustedTankStats, getWeaponPattern } from "./tankClasses.js";
import { computeFireRecoilImpulse, summarizeRecoilImpulse } from "./tankRecoil.js";

const ROLE_EXPECTATIONS = {
  booster: { x: "positive", minSpeed: 6 },
  fighter: { x: "positive", minSpeed: 3 },
  triAngle: { x: "positive", minSpeed: 2 },
  flankGuard: { x: "nearZero", maxSpeed: 2.5 },
  quadTank: { x: "nearZero", maxSpeed: 2.5 },
  octoTank: { x: "nearZero", maxSpeed: 2.5 },
  tripleTwin: { x: "nearZero", maxSpeed: 2.5 },
  destroyer: { x: "negative", minSpeed: 20 },
  annihilator: { x: "negative", minSpeed: 25 },
  siegeCore: { x: "negative", minSpeed: 60, dominantRole: "heavy" },
  missileCommand: { x: "negative", minSpeed: 45, dominantRole: "heavy" },
  hybrid: { x: "negative", minSpeed: 16 },
  streamliner: { x: "negative", minSpeed: 8 },
  stormcaller: { x: "negative", minSpeed: 2, maxSpeed: 8 },
  trapper: { x: "negative", maxSpeed: 16 },
  minefield: { x: "negative", maxSpeed: 18 },
  aegisBastion: { x: "negative", maxSpeed: 20, dominantRole: "trap" },
  comet: { x: "positive", minSpeed: 8, dominantRole: "rear" },
  hiveLord: { x: "nearZero", maxSpeed: 0.1, dominantRole: "none" },
  rammer: { x: "negative", maxSpeed: 12 },
  spike: { x: "negative", maxSpeed: 8 }
};

export function getClassPhysicsSummary(config = TANK_CLASS_CONFIG, base = GAME_CONFIG) {
  return Object.fromEntries(
    Object.keys(config.classes).map((classId) => {
      const stats = getClassAdjustedTankStats(getTankStats({}, base), classId, config);
      const impulse = computeFireRecoilImpulse({
        tank: {
          classId,
          aimAngle: 0,
          recoilMultiplier: stats.recoilMultiplier ?? 1,
          state: "alive"
        },
        shots: getWeaponPattern(classId, config),
        aimAngle: 0,
        classRecoilMultiplier: stats.recoilMultiplier ?? 1,
        baseProjectileRadius: base.projectile.radius
      });
      return [
        classId,
        {
          classId,
          ...summarizeRecoilImpulse(impulse)
        }
      ];
    })
  );
}

export function validateClassPhysicsCoherence(config = TANK_CLASS_CONFIG, base = GAME_CONFIG) {
  const issues = [];
  const summary = getClassPhysicsSummary(config, base);

  for (const [classId, expectation] of Object.entries(ROLE_EXPECTATIONS)) {
    const entry = summary[classId];
    if (!entry) {
      issues.push(`${classId} is missing from class physics summary.`);
      continue;
    }
    if (expectation.x === "positive" && entry.x <= 0) {
      issues.push(`${classId} should gain forward recoil thrust, got x=${entry.x}.`);
    }
    if (expectation.x === "negative" && entry.x >= 0) {
      issues.push(`${classId} should kick backward, got x=${entry.x}.`);
    }
    if (expectation.x === "nearZero" && Math.abs(entry.x) > expectation.maxSpeed) {
      issues.push(`${classId} should have mostly cancelling recoil, got x=${entry.x}.`);
    }
    if (Number.isFinite(expectation.minSpeed) && entry.speed < expectation.minSpeed) {
      issues.push(`${classId} recoil speed ${entry.speed} is below ${expectation.minSpeed}.`);
    }
    if (Number.isFinite(expectation.maxSpeed) && entry.speed > expectation.maxSpeed) {
      issues.push(`${classId} recoil speed ${entry.speed} exceeds ${expectation.maxSpeed}.`);
    }
    if (expectation.dominantRole && entry.dominantRole !== expectation.dominantRole) {
      issues.push(`${classId} should use ${expectation.dominantRole} recoil role, got ${entry.dominantRole}.`);
    }
  }

  return issues;
}
