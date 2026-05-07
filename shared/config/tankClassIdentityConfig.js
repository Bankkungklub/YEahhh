export const TANK_CLASS_FEEDBACK_PROFILES = Object.freeze([
  "standard",
  "rapid",
  "precision",
  "spread",
  "storm",
  "heavy",
  "rocket",
  "missile",
  "trap",
  "drone",
  "booster",
  "body"
]);

export const TANK_CLASS_IDENTITY_LIMITS = Object.freeze({
  roleLabel: 18,
  weaponLine: 48,
  strengthLine: 52,
  weaknessLine: 52
});

export const TANK_CLASS_IDENTITY_CONFIG = deepFreeze({
  basic: identity("Balanced", "Single cannon with stable all-round pressure.", "Good first duel and farm form.", "No strong specialty yet.", ["starter"], "standard"),
  twin: identity("Twin Pressure", "Two forward bullets for steady pressure.", "More lanes than Basic.", "Lower damage per bullet.", ["duel", "spread"], "spread"),
  sniper: identity("Long Range", "Harder faster shots with slower reload.", "Controls distance well.", "Weak if rushed between shots.", ["range"], "precision"),
  machineGun: identity("Rapid Fire", "Fast low-damage cannon fire.", "Great early farming rhythm.", "Lower burst per shot.", ["rapid", "farm"], "rapid"),
  flankGuard: identity("Two-Way Guard", "Forward and rear shots cover retreats.", "Safer farming while moving.", "Less focused front damage.", ["control"], "spread"),

  tripleShot: identity("Cone Pressure", "Three forward bullets in a wide cone.", "Punishes close dodges.", "Spread loses power at range.", ["spread"], "spread"),
  quadTank: identity("Area Control", "Four-way fire covers every side.", "Protects space around you.", "Weak focused dueling damage.", ["control"], "spread"),
  twinFlank: identity("Flank Control", "Twin shots forward and backward.", "Controls approach lanes.", "Side angles stay exposed.", ["control"], "spread"),
  triAngle: identity("Boost Striker", "Front shot plus rear booster thrust.", "Fast chase and escape.", "Can overextend into traps.", ["mobility", "booster"], "booster"),
  assassin: identity("Deep Sniper", "Very long-range precision bullet.", "Pokes before enemies answer.", "Slow reload if pressured.", ["range"], "precision"),
  overseer: identity("Drone Control", "Two drones attack where you aim.", "Controls space from angles.", "Weak while drones rebuild.", ["drone", "control"], "drone"),
  hunter: identity("Stacked Sniper", "Layered forward sniper barrels.", "Strong straight-line poke.", "Narrow aim requirement.", ["range"], "precision"),
  destroyer: identity("Heavy Cannon", "One slow high-damage shell.", "Huge burst if it connects.", "Long miss window.", ["heavy", "burst"], "heavy"),
  gunner: identity("Micro Barrage", "Four small forward bullets.", "Reliable pressure stream.", "Lower burst per pellet.", ["rapid"], "rapid"),

  triplet: identity("Focused Triple", "Three tight forward barrels.", "Strong direct dueling.", "Less side coverage.", ["duel"], "rapid"),
  pentaShot: identity("Wide Spread", "Five-shot forward fan.", "Clears shapes and drones.", "Weak at long range.", ["spread"], "spread"),
  octoTank: identity("Full Coverage", "Eight-direction bullet coverage.", "Denies swarm approaches.", "Low focused kill pressure.", ["control"], "spread"),
  tripleTwin: identity("Multi-Axis", "Three twin axes cover lanes.", "Hard to flank cleanly.", "No single heavy shot.", ["control"], "spread"),
  stalker: identity("Extreme Range", "Long-lived sniper shot.", "Controls far sightlines.", "Punished after misses.", ["range"], "precision"),
  overlord: identity("Heavy Drones", "Four command drones pressure targets.", "Strong zone threat.", "Drones can be shot down.", ["drone"], "drone"),
  necromancer: identity("Swarm Raiser", "Converts shapes into temporary drones.", "Snowballs from farming.", "Needs setup and shapes.", ["drone", "farm"], "drone"),
  booster: identity("Rocket Chaser", "Rear boosters push hard forward.", "Fastest chase pressure.", "Can fly into danger.", ["booster"], "booster"),
  fighter: identity("Agile Striker", "Forward, side, and rear booster fire.", "Flexible chase angles.", "Lower HP if caught.", ["mobility"], "booster"),
  predator: identity("Precision Scope", "Long single bullet with range focus.", "Great distant picks.", "Poor crowd control.", ["range"], "precision"),
  streamliner: identity("Bullet Stream", "Straight timed stream of five shots.", "Steady forward pressure.", "Narrow firing lane.", ["rapid", "delayed"], "rapid"),
  annihilator: identity("Massive Shell", "Huge slow shell with heavy kick.", "Terrifying burst damage.", "Very punishable miss.", ["heavy"], "heavy"),
  hybrid: identity("Shell Escort", "Heavy shell with small escort pellets.", "Burst plus light coverage.", "Still reloads slowly.", ["heavy"], "heavy"),
  autoGunner: identity("Dense Fire", "Five forward micro-bullets.", "Excellent sustained duels.", "Needs tracking aim.", ["rapid"], "rapid"),
  sprayer: identity("Spray Control", "Wide rapid spray of bullets.", "Suppresses close groups.", "Damage spreads out.", ["spread", "rapid"], "rapid"),
  fireworkTank: identity("Burst Rocket", "Slow rocket bursts into sparks.", "Area damage from impact.", "Rocket can be dodged.", ["rocket"], "rocket"),
  starburst: identity("Spark Rocket", "Heavy rocket bursts into a star.", "Strong area denial.", "Slow explosive reload.", ["rocket"], "rocket"),
  trapper: identity("Trap Control", "Places armed bullet-blocking traps.", "Builds defensive space.", "Needs setup time.", ["trap"], "trap"),
  minefield: identity("Mine Wall", "Places three control traps.", "Locks down lanes.", "Weak while relocating.", ["trap"], "trap"),
  rammer: identity("Body Rush", "Fast body tank with weak nose shot.", "Wins by contact pressure.", "Kited by ranged fire.", ["body"], "body"),
  spike: identity("Body Fortress", "High body damage and resistance.", "Punishes contact fights.", "No real ranged burst.", ["body"], "body"),

  missileCommand: identity("Missile Salvo", "Guided missiles burst into sparks.", "Pressures dodging targets.", "Steering is time-limited.", ["missile", "rocket"], "missile"),
  stormcaller: identity("Storm Burst", "Timed spiral burst of low-damage bullets.", "Floods space and drones.", "Lower focused damage.", ["storm", "delayed"], "storm"),
  siegeCore: identity("Siege Shell", "One enormous slow siege shell.", "Deletes space on hit.", "Very slow reload.", ["heavy", "burst"], "heavy"),
  hiveLord: identity("Hive Swarm", "Larger temporary drone swarm.", "Dominates after setup.", "Swarm can be cleared.", ["drone", "swarm"], "drone"),
  aegisBastion: identity("Trap Bastion", "Wide wall of bullet-blocking traps.", "Strong objective defense.", "Weak when forced to move.", ["trap"], "trap"),
  comet: identity("Comet Boost", "High-speed striker with booster thrust.", "Chases and repositions.", "Lower HP and risky speed.", ["booster", "mobility"], "booster")
});

function identity(roleLabel, weaponLine, strengthLine, weaknessLine, feelTags, feedbackProfile) {
  return {
    roleLabel,
    weaponLine,
    strengthLine,
    weaknessLine,
    feelTags,
    feedbackProfile
  };
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
