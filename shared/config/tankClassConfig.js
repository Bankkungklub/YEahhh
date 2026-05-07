import { DRONE_CONFIG } from "./droneConfig.js";

export const TANK_CLASS_LEVELS = [1, 15, 30, 45, 60];

const PI = Math.PI;

export const TANK_CLASS_ICON_BODIES = ["circle", "square", "diamond", "triangle", "hex", "spike"];
export const TANK_CLASS_ICON_RINGS = ["none", "thin", "heavy", "dashed"];
export const TANK_CLASS_ICON_CORES = ["none", "dot", "diamond", "star"];
export const TANK_CLASS_ACCENT_TYPES = ["sidePod", "spike", "shield", "rocketFin"];
export const TANK_CLASS_BARREL_STYLES = ["standard", "long", "heavy", "mini", "trap", "rocket"];
export const TANK_CLASS_BALANCE_ROLES = [
  "starter",
  "sustain",
  "burst",
  "spread",
  "control",
  "range",
  "mobility",
  "body",
  "trap",
  "rocket",
  "ultimateSustain",
  "ultimateBurst",
  "ultimateControl",
  "ultimateRocket",
  "ultimateTrap",
  "ultimateMobility"
];

const ROLE_BUDGETS = {
  starter: budget(0.85, 1.2, 0.85, 1.2),
  sustain: budget(0.7, 2.55, 0.9, 2.7),
  burst: budget(0.65, 1.9, 0.65, 2.05),
  spread: budget(0.15, 2.45, 1.1, 3.0),
  control: budget(0.05, 1.9, 0.65, 3.0),
  range: budget(0.75, 1.65, 0.75, 1.85),
  mobility: budget(0.55, 1.85, 0.9, 2.7),
  body: budget(0.02, 0.9, 0.02, 1.0),
  trap: budget(0.35, 1.55, 0.35, 1.85),
  rocket: budget(0.35, 1.3, 0.35, 1.45),
  ultimateSustain: budget(0.45, 3.2, 1.0, 3.45),
  ultimateBurst: budget(0.45, 2.75, 0.45, 2.95),
  ultimateControl: budget(0.04, 2.45, 0.65, 3.65),
  ultimateRocket: budget(0.25, 2.1, 0.35, 2.45),
  ultimateTrap: budget(0.2, 2.15, 0.3, 2.45),
  ultimateMobility: budget(0.45, 2.55, 0.85, 3.25)
};

const CLASS_BALANCE_ROLES = {
  basic: "starter",
  twin: "sustain",
  sniper: "range",
  machineGun: "sustain",
  flankGuard: "control",
  tripleShot: "spread",
  quadTank: "control",
  twinFlank: "control",
  triAngle: "mobility",
  assassin: "range",
  overseer: "control",
  hunter: "range",
  destroyer: "burst",
  gunner: "sustain",
  triplet: "sustain",
  pentaShot: "spread",
  octoTank: "control",
  tripleTwin: "control",
  stalker: "range",
  overlord: "control",
  necromancer: "control",
  booster: "mobility",
  fighter: "mobility",
  predator: "range",
  streamliner: "sustain",
  annihilator: "burst",
  hybrid: "burst",
  autoGunner: "sustain",
  sprayer: "spread",
  fireworkTank: "rocket",
  starburst: "rocket",
  trapper: "trap",
  minefield: "trap",
  rammer: "body",
  spike: "body",
  missileCommand: "ultimateRocket",
  stormcaller: "ultimateSustain",
  siegeCore: "ultimateBurst",
  hiveLord: "ultimateControl",
  aegisBastion: "ultimateTrap",
  comet: "ultimateMobility"
};

const CLASS_VISUAL_OVERRIDES = {
  basic: { ring: "none", core: "none" },
  twin: { ring: "thin", core: "none" },
  sniper: { bodyScale: 0.9, ring: "thin", core: "none", barrels: [{ angle: 0, length: 46, width: 9, style: "long" }] },
  machineGun: { body: "hex", ring: "thin", core: "none", barrels: [{ angle: 0, length: 32, width: 18, style: "mini" }] },
  flankGuard: { body: "square", ring: "thin", core: "none" },
  tripleShot: { body: "hex", ring: "thin", core: "none", barrels: styledBarrels(iconSpread([-0.24, 0, 0.24], 32, 11), "standard") },
  quadTank: { body: "hex", ring: "heavy", core: "none", barrels: styledBarrels(iconRadial(4, 30, 11), "standard") },
  twinFlank: { body: "square", ring: "thin", core: "none" },
  triAngle: {
    body: "triangle",
    ring: "thin",
    core: "none",
    accents: [
      accent("rocketFin", (PI * 3) / 4, 0.82, 1.06),
      accent("rocketFin", (-PI * 3) / 4, 0.82, 1.06)
    ]
  },
  assassin: { bodyScale: 0.86, ring: "thin", core: "none", barrels: [{ angle: 0, length: 56, width: 8, style: "long" }] },
  overseer: {
    body: "hex",
    ring: "heavy",
    core: "none",
    accents: [
      accent("sidePod", -PI / 2, 0.6, 0.82),
      accent("sidePod", PI / 2, 0.6, 0.82)
    ]
  },
  hunter: {
    bodyScale: 0.92,
    ring: "thin",
    core: "none",
    barrels: [
      { angle: -0.05, length: 50, width: 10, style: "long" },
      { angle: 0.05, length: 36, width: 8, style: "mini" }
    ]
  },
  destroyer: { body: "square", bodyScale: 1.08, ring: "heavy", core: "none", barrels: [{ angle: 0, length: 46, width: 26, style: "heavy" }] },
  gunner: { body: "hex", ring: "thin", core: "none", barrels: styledBarrels(iconSpread([-0.1, -0.03, 0.03, 0.1], 31, 8), "mini") },
  triplet: { body: "hex", ring: "heavy", core: "none", barrels: styledBarrels(iconSpread([-0.08, 0, 0.08], 36, 11), "standard") },
  pentaShot: { body: "hex", ring: "thin", core: "none", barrels: styledBarrels(iconSpread([-0.48, -0.24, 0, 0.24, 0.48], 31, 9), "mini") },
  octoTank: { body: "hex", ring: "heavy", core: "none", barrels: styledBarrels(iconRadial(8, 28, 8), "mini") },
  tripleTwin: { body: "square", ring: "heavy", core: "none", barrels: styledBarrels(iconSpread([0, PI, (PI * 2) / 3, (-PI) / 3, (-PI * 2) / 3, PI / 3], 28, 8), "mini") },
  stalker: { body: "hex", bodyScale: 0.82, ring: "thin", core: "none", barrels: [{ angle: 0, length: 64, width: 7, style: "long" }] },
  overlord: {
    body: "hex",
    ring: "heavy",
    core: "none",
    accents: [
      accent("sidePod", 0, 0.56, 0.9),
      accent("sidePod", PI / 2, 0.56, 0.9),
      accent("sidePod", PI, 0.56, 0.9),
      accent("sidePod", -PI / 2, 0.56, 0.9)
    ],
    barrels: styledBarrels(iconRadial(4, 31, 10), "standard")
  },
  necromancer: {
    body: "diamond",
    ring: "thin",
    core: "none",
    accents: [
      accent("sidePod", -PI / 2, 0.52, 0.86),
      accent("sidePod", PI / 2, 0.52, 0.86)
    ],
    barrels: styledBarrels(iconRadial(6, 27, 8), "mini")
  },
  booster: {
    body: "triangle",
    bodyScale: 1.06,
    ring: "heavy",
    core: "none",
    accents: [
      accent("rocketFin", (PI * 3) / 4, 0.9, 1.12),
      accent("rocketFin", (-PI * 3) / 4, 0.9, 1.12)
    ],
    barrels: styledBarrels(iconSpread([0, (PI * 3) / 4, (-PI * 3) / 4], 33, 10), "rocket")
  },
  fighter: {
    body: "triangle",
    ring: "thin",
    core: "none",
    accents: [
      accent("rocketFin", (PI * 3) / 4, 0.72, 1.1),
      accent("rocketFin", (-PI * 3) / 4, 0.72, 1.1)
    ],
    barrels: styledBarrels(iconSpread([0, -0.48, 0.48, (PI * 3) / 4, (-PI * 3) / 4], 28, 8), "mini")
  },
  predator: {
    body: "hex",
    bodyScale: 0.88,
    ring: "heavy",
    core: "none",
    accents: [
      accent("sidePod", -PI / 2, 0.38, 0.72),
      accent("sidePod", PI / 2, 0.38, 0.72)
    ],
    barrels: [{ angle: 0, length: 66, width: 7, style: "long" }]
  },
  streamliner: {
    body: "hex",
    ring: "thin",
    core: "none",
    barrels: styledBarrels([
      { angle: 0, length: 34, width: 5 },
      { angle: 0, length: 38, width: 5 },
      { angle: 0, length: 42, width: 5 },
      { angle: 0, length: 46, width: 5 },
      { angle: 0, length: 50, width: 5 }
    ], "mini")
  },
  annihilator: {
    body: "hex",
    bodyScale: 1.12,
    ring: "heavy",
    core: "none",
    accents: [accent("shield", PI, 0.76, 1.04)],
    barrels: [{ angle: 0, length: 52, width: 31, style: "heavy" }]
  },
  hybrid: {
    body: "square",
    bodyScale: 1.05,
    ring: "heavy",
    core: "none",
    accents: [
      accent("sidePod", -PI / 2, 0.62, 0.92),
      accent("sidePod", PI / 2, 0.62, 0.92)
    ],
    barrels: [
      { angle: 0, length: 43, width: 20, style: "heavy" },
      { angle: -0.18, length: 34, width: 7, style: "mini" },
      { angle: 0.18, length: 34, width: 7, style: "mini" }
    ]
  },
  autoGunner: { body: "hex", ring: "heavy", core: "none", barrels: styledBarrels(iconSpread([-0.12, -0.04, 0, 0.04, 0.12], 30, 7), "mini") },
  sprayer: { body: "hex", ring: "thin", core: "none", barrels: styledBarrels(iconSpread([-0.34, -0.22, -0.1, 0, 0.1, 0.22, 0.34], 27, 7), "mini") },
  fireworkTank: {
    body: "hex",
    ring: "thin",
    core: "none",
    accents: [
      accent("rocketFin", -PI / 2, 0.62, 0.96),
      accent("rocketFin", PI / 2, 0.62, 0.96)
    ],
    barrels: [{ angle: 0, length: 40, width: 20, style: "rocket" }]
  },
  starburst: {
    body: "hex",
    bodyScale: 1.08,
    ring: "heavy",
    core: "none",
    accents: [
      accent("rocketFin", -PI / 2, 0.8, 1),
      accent("rocketFin", PI / 2, 0.8, 1),
      accent("rocketFin", PI, 0.62, 0.9)
    ],
    barrels: [{ angle: 0, length: 46, width: 22, style: "rocket" }]
  },
  trapper: {
    body: "square",
    ring: "thin",
    core: "none",
    accents: [
      accent("sidePod", -PI / 2, 0.52, 0.86),
      accent("sidePod", PI / 2, 0.52, 0.86)
    ],
    barrels: [{ angle: 0, length: 34, width: 18, style: "trap" }]
  },
  minefield: {
    body: "diamond",
    ring: "thin",
    core: "none",
    accents: [
      accent("sidePod", -PI / 2, 0.58, 0.92),
      accent("sidePod", PI / 2, 0.58, 0.92)
    ],
    barrels: styledBarrels(iconSpread([-0.18, 0, 0.18], 31, 13), "trap")
  },
  missileCommand: {
    body: "hex",
    bodyScale: 1.1,
    ring: "heavy",
    core: "star",
    accents: [
      accent("rocketFin", -PI / 2, 0.82, 1.04),
      accent("rocketFin", PI / 2, 0.82, 1.04),
      accent("rocketFin", PI, 0.68, 0.96)
    ],
    barrels: styledBarrels(iconSpread([-0.16, 0, 0.16], 46, 17), "rocket")
  },
  stormcaller: {
    body: "hex",
    ring: "dashed",
    core: "star",
    barrels: styledBarrels(iconSpread([-0.62, -0.42, -0.24, -0.08, 0.08, 0.24, 0.42, 0.62], 28, 6), "mini")
  },
  siegeCore: {
    body: "square",
    bodyScale: 1.18,
    ring: "heavy",
    core: "diamond",
    accents: [accent("shield", PI, 0.9, 1.08)],
    barrels: [{ angle: 0, length: 56, width: 34, style: "heavy" }]
  },
  hiveLord: {
    body: "diamond",
    ring: "heavy",
    core: "star",
    accents: [
      accent("sidePod", 0, 0.54, 0.88),
      accent("sidePod", PI / 2, 0.54, 0.88),
      accent("sidePod", PI, 0.54, 0.88),
      accent("sidePod", -PI / 2, 0.54, 0.88)
    ],
    barrels: styledBarrels(iconRadial(8, 27, 7), "mini")
  },
  aegisBastion: {
    body: "diamond",
    bodyScale: 1.1,
    ring: "heavy",
    core: "diamond",
    accents: [
      accent("shield", -0.4, 0.72, 1.04),
      accent("shield", 0.4, 0.72, 1.04)
    ],
    barrels: styledBarrels(iconSpread([-0.34, -0.17, 0, 0.17, 0.34], 34, 12), "trap")
  },
  comet: {
    body: "triangle",
    bodyScale: 1.08,
    ring: "dashed",
    core: "star",
    accents: [
      accent("rocketFin", (PI * 3) / 4, 0.92, 1.15),
      accent("rocketFin", (-PI * 3) / 4, 0.92, 1.15)
    ],
    barrels: styledBarrels(iconSpread([0, -0.42, 0.42, 2.35, -2.35, PI], 29, 7), "mini")
  },
  rammer: {
    body: "diamond",
    bodyScale: 1.1,
    ring: "heavy",
    core: "none",
    accents: [
      accent("spike", 0, 0.68, 1.12),
      accent("spike", -PI / 2, 0.5, 1.02),
      accent("spike", PI / 2, 0.5, 1.02)
    ],
    barrels: [{ angle: 0, length: 22, width: 8, style: "mini" }]
  },
  spike: {
    body: "spike",
    bodyScale: 1.14,
    ring: "heavy",
    core: "none",
    accents: [
      accent("spike", 0, 0.82, 1.18),
      accent("spike", PI / 4, 0.54, 1.1),
      accent("spike", -PI / 4, 0.54, 1.1),
      accent("spike", (PI * 3) / 4, 0.48, 1.06),
      accent("spike", (-PI * 3) / 4, 0.48, 1.06)
    ],
    barrels: [{ angle: 0, length: 18, width: 7, style: "mini" }]
  }
};

const classConfig = {
  defaultClassId: "basic",
  maxSelectableLevel: 60,
  levels: TANK_CLASS_LEVELS,
  weaponPatterns: {
    none: [],
    single: [
      shot(0, 0, 1, 1)
    ],
    twin: [
      shot(0, -8, 0.78, 1),
      shot(0, 8, 0.78, 1)
    ],
    sniper: [
      shot(0, 0, 1, 1)
    ],
    machineGun: [
      shot(0, 0, 1, 1)
    ],
    flankGuard: [
      shot(0, 0, 0.82, 1),
      shot(PI, 0, 0.82, 1)
    ],
    tripleShot: spread([-0.24, 0, 0.24], 0.66, 1),
    quadTank: radial(4, 0.62, 1),
    twinFlank: [
      shot(0, -8, 0.58, 1),
      shot(0, 8, 0.58, 1),
      shot(PI, -8, 0.58, 1),
      shot(PI, 8, 0.58, 1)
    ],
    triAngle: [
      shot(0, 0, 0.92, 1.05, { recoilWeight: 0.55, recoilRole: "front" }),
      shot((PI * 3) / 4, 0, 0.54, 1, { recoilWeight: 0.95, recoilRole: "rear" }),
      shot((-PI * 3) / 4, 0, 0.54, 1, { recoilWeight: 0.95, recoilRole: "rear" })
    ],
    assassin: [
      shot(0, 0, 1, 1)
    ],
    hunter: [
      shot(0, -3, 1, 1),
      shot(0, 5, 0.55, 1.08)
    ],
    destroyer: [
      shot(0, 0, 1, 1, { recoilWeight: 1.15, recoilRole: "heavy" })
    ],
    gunner: [
      shot(-0.1, -12, 0.45, 1, { delayMs: 0 }),
      shot(-0.03, -4, 0.45, 1, { delayMs: 28 }),
      shot(0.03, 4, 0.45, 1, { delayMs: 56 }),
      shot(0.1, 12, 0.45, 1, { delayMs: 84 })
    ],
    triplet: [
      shot(-0.08, -8, 0.72, 1),
      shot(0, 0, 0.72, 1),
      shot(0.08, 8, 0.72, 1)
    ],
    pentaShot: spread([-0.48, -0.24, 0, 0.24, 0.48], 0.48, 1),
    octoTank: radial(8, 0.38, 1),
    tripleTwin: [
      shot(0, -7, 0.42, 1),
      shot(0, 7, 0.42, 1),
      shot((PI * 2) / 3, -7, 0.42, 1),
      shot((PI * 2) / 3, 7, 0.42, 1),
      shot((-PI * 2) / 3, -7, 0.42, 1),
      shot((-PI * 2) / 3, 7, 0.42, 1)
    ],
    stalker: [
      shot(0, 0, 1, 1)
    ],
    booster: [
      shot(0, 0, 0.74, 1.04, { recoilWeight: 0.35, recoilRole: "front" }),
      shot((PI * 3) / 4, -5, 0.44, 1, { recoilWeight: 1.7, recoilRole: "rear" }),
      shot((-PI * 3) / 4, 5, 0.44, 1, { recoilWeight: 1.7, recoilRole: "rear" })
    ],
    fighter: [
      shot(0, 0, 0.64, 1.02, { recoilWeight: 0.35, recoilRole: "front" }),
      shot(-0.48, -10, 0.42, 1, { recoilWeight: 0.25, recoilRole: "side" }),
      shot(0.48, 10, 0.42, 1, { recoilWeight: 0.25, recoilRole: "side" }),
      shot((PI * 3) / 4, -8, 0.34, 0.95, { recoilWeight: 1.7, recoilRole: "rear" }),
      shot((-PI * 3) / 4, 8, 0.34, 0.95, { recoilWeight: 1.7, recoilRole: "rear" })
    ],
    predator: [
      shot(0, 0, 1, 1)
    ],
    streamliner: [
      shot(0, 0, 0.34, 1.05, { delayMs: 0, recoilWeight: 0.45 }),
      shot(0, 0, 0.34, 1.05, { delayMs: 45, recoilWeight: 0.45 }),
      shot(0, 0, 0.34, 1.05, { delayMs: 90, recoilWeight: 0.45 }),
      shot(0, 0, 0.34, 1.05, { delayMs: 135, recoilWeight: 0.45 }),
      shot(0, 0, 0.34, 1.05, { delayMs: 180, recoilWeight: 0.45 })
    ],
    annihilator: [
      shot(0, 0, 1, 1, { recoilWeight: 1.25, recoilRole: "heavy" })
    ],
    hybrid: [
      shot(0, 0, 0.9, 1, { recoilWeight: 1.12, recoilRole: "heavy" }),
      shot(-0.18, -12, 0.24, 1.12, { recoilWeight: 0.35, recoilRole: "front" }),
      shot(0.18, 12, 0.24, 1.12, { recoilWeight: 0.35, recoilRole: "front" })
    ],
    autoGunner: [
      shot(-0.12, -13, 0.35, 1, { delayMs: 0 }),
      shot(-0.04, -5, 0.35, 1, { delayMs: 24 }),
      shot(0.04, 5, 0.35, 1, { delayMs: 48 }),
      shot(0.12, 13, 0.35, 1, { delayMs: 72 }),
      shot(0, 0, 0.32, 1.04, { delayMs: 96 })
    ],
    sprayer: [
      shot(-0.34, 0, 0.28, 0.98, { delayMs: 0 }),
      shot(-0.22, 0, 0.28, 0.98, { delayMs: 20 }),
      shot(-0.1, 0, 0.28, 0.98, { delayMs: 40 }),
      shot(0, 0, 0.28, 0.98, { delayMs: 60 }),
      shot(0.1, 0, 0.28, 0.98, { delayMs: 80 }),
      shot(0.22, 0, 0.28, 0.98, { delayMs: 100 }),
      shot(0.34, 0, 0.28, 0.98, { delayMs: 120 })
    ],
    fireworkRocket: [
      shot(0, 0, 0.9, 0.82, { kind: "rocket", behavior: "rocket", barrelLength: 20, recoilMultiplier: 1.15 })
    ],
    starburstRocket: [
      shot(0, 0, 1.05, 0.78, { kind: "rocket", behavior: "starburst", barrelLength: 22, recoilMultiplier: 1.25 })
    ],
    missileCommand: [
      shot(-0.16, -10, 0.72, 0.72, { kind: "rocket", behavior: "missile", delayMs: 0, barrelLength: 23, recoilWeight: 1.1, recoilRole: "heavy" }),
      shot(0, 0, 0.72, 0.72, { kind: "rocket", behavior: "missile", delayMs: 70, barrelLength: 23, recoilWeight: 1.1, recoilRole: "heavy" }),
      shot(0.16, 10, 0.72, 0.72, { kind: "rocket", behavior: "missile", delayMs: 140, barrelLength: 23, recoilWeight: 1.1, recoilRole: "heavy" })
    ],
    stormcaller: [
      shot(-0.42, 0, 0.22, 0.96, { delayMs: 0, recoilWeight: 0.22 }),
      shot(-0.24, 0, 0.22, 0.96, { delayMs: 25, recoilWeight: 0.22 }),
      shot(-0.08, 0, 0.22, 0.96, { delayMs: 50, recoilWeight: 0.22 }),
      shot(0.08, 0, 0.22, 0.96, { delayMs: 75, recoilWeight: 0.22 }),
      shot(0.24, 0, 0.22, 0.96, { delayMs: 100, recoilWeight: 0.22 }),
      shot(0.42, 0, 0.22, 0.96, { delayMs: 125, recoilWeight: 0.22 }),
      shot(0.62, 0, 0.22, 0.96, { delayMs: 150, recoilWeight: 0.22 }),
      shot(-0.62, 0, 0.22, 0.96, { delayMs: 175, recoilWeight: 0.22 })
    ],
    siegeCore: [
      shot(0, 0, 1, 1, { recoilWeight: 1.45, recoilRole: "heavy", barrelLength: 26 })
    ],
    aegisBastion: [
      shot(-0.34, -14, 0.68, 0.38, { kind: "trap", behavior: "trap", barrelLength: 14, recoilMultiplier: 0.48, recoilRole: "trap" }),
      shot(-0.17, -7, 0.68, 0.38, { kind: "trap", behavior: "trap", barrelLength: 14, recoilMultiplier: 0.48, recoilRole: "trap" }),
      shot(0, 0, 0.68, 0.38, { kind: "trap", behavior: "trap", barrelLength: 14, recoilMultiplier: 0.48, recoilRole: "trap" }),
      shot(0.17, 7, 0.68, 0.38, { kind: "trap", behavior: "trap", barrelLength: 14, recoilMultiplier: 0.48, recoilRole: "trap" }),
      shot(0.34, 14, 0.68, 0.38, { kind: "trap", behavior: "trap", barrelLength: 14, recoilMultiplier: 0.48, recoilRole: "trap" })
    ],
    comet: [
      shot(0, 0, 0.56, 1.04, { recoilWeight: 0.28, recoilRole: "front" }),
      shot(-0.42, -10, 0.32, 1.02, { recoilWeight: 0.22, recoilRole: "side" }),
      shot(0.42, 10, 0.32, 1.02, { recoilWeight: 0.22, recoilRole: "side" }),
      shot(2.35, -8, 0.28, 0.98, { recoilWeight: 1.95, recoilRole: "rear" }),
      shot(-2.35, 8, 0.28, 0.98, { recoilWeight: 1.95, recoilRole: "rear" }),
      shot(PI, 0, 0.28, 0.98, { recoilWeight: 1.95, recoilRole: "rear" })
    ],
    trapShot: [
      shot(0, 0, 0.9, 0.48, { kind: "trap", behavior: "trap", barrelLength: 12, recoilMultiplier: 0.65, recoilRole: "trap" })
    ],
    tripleTrap: [
      shot(-0.18, -7, 0.75, 0.42, { kind: "trap", behavior: "trap", barrelLength: 12, recoilMultiplier: 0.55, recoilRole: "trap" }),
      shot(0, 0, 0.75, 0.42, { kind: "trap", behavior: "trap", barrelLength: 12, recoilMultiplier: 0.55, recoilRole: "trap" }),
      shot(0.18, 7, 0.75, 0.42, { kind: "trap", behavior: "trap", barrelLength: 12, recoilMultiplier: 0.55, recoilRole: "trap" })
    ],
    weakNoseShot: [
      shot(0, 0, 0.45, 0.9, { kind: "bullet", behavior: "bullet", barrelLength: 10, recoilMultiplier: 0.35, recoilRole: "low" })
    ],
    tinySpikeShot: [
      shot(0, 0, 0.25, 0.75, { kind: "bullet", behavior: "bullet", barrelLength: 8, recoilMultiplier: 0.2, recoilRole: "low" })
    ]
  },
  classes: {
    basic: classNode({
      id: "basic",
      name: "Basic",
      unlockLevel: 1,
      parentId: null,
      children: ["twin", "sniper", "machineGun", "flankGuard"],
      weaponPattern: "single",
      themeColor: "#58dede",
      description: "Balanced starter tank.",
      tags: ["duel"],
      icon: { body: "circle", barrels: [{ angle: 0, length: 34, width: 14 }] }
    }),
    twin: classNode({
      id: "twin",
      name: "Twin",
      unlockLevel: 15,
      parentId: "basic",
      children: ["tripleShot", "quadTank"],
      weaponPattern: "twin",
      themeColor: "#8de8e2",
      description: "Two forward barrels with lower per-shot damage.",
      statModifiers: { reload: 1.08 },
      tags: ["duel", "spread"],
      icon: {
        body: "circle",
        barrels: [
          { angle: -0.16, length: 32, width: 12 },
          { angle: 0.16, length: 32, width: 12 }
        ]
      }
    }),
    sniper: classNode({
      id: "sniper",
      name: "Sniper",
      unlockLevel: 15,
      parentId: "basic",
      children: ["assassin", "overseer", "hunter", "trapper"],
      weaponPattern: "sniper",
      themeColor: "#b8f28e",
      description: "Harder, faster bullets with a slower rhythm.",
      statModifiers: { damage: 1.25, bulletSpeed: 1.25, reload: 1.18 },
      tags: ["range"],
      icon: { body: "circle", barrels: [{ angle: 0, length: 44, width: 11 }] }
    }),
    machineGun: classNode({
      id: "machineGun",
      name: "Machine Gun",
      unlockLevel: 15,
      parentId: "basic",
      children: ["destroyer", "gunner", "fireworkTank"],
      weaponPattern: "machineGun",
      themeColor: "#ff8c8c",
      description: "Fast reload, lower damage per shot.",
      statModifiers: { damage: 0.72, bulletSpeed: 0.95, reload: 0.62 },
      tags: ["farm", "duel"],
      icon: { body: "circle", barrels: [{ angle: 0, length: 32, width: 18 }] }
    }),
    flankGuard: classNode({
      id: "flankGuard",
      name: "Flank Guard",
      unlockLevel: 15,
      parentId: "basic",
      children: ["twinFlank", "triAngle", "rammer"],
      weaponPattern: "flankGuard",
      themeColor: "#fff28a",
      description: "Shoots forward and backward for safer farming.",
      tags: ["farm", "spread"],
      icon: {
        body: "circle",
        barrels: [
          { angle: 0, length: 30, width: 12 },
          { angle: PI, length: 30, width: 12 }
        ]
      }
    }),
    tripleShot: classNode({
      id: "tripleShot",
      name: "Triple Shot",
      unlockLevel: 30,
      parentId: "twin",
      children: ["triplet", "pentaShot"],
      weaponPattern: "tripleShot",
      themeColor: "#8de8e2",
      description: "Three-way forward spread for pressure.",
      statModifiers: { reload: 1.12 },
      tags: ["duel", "spread"],
      icon: { body: "circle", barrels: iconSpread([-0.24, 0, 0.24], 32, 11) }
    }),
    quadTank: classNode({
      id: "quadTank",
      name: "Quad Tank",
      unlockLevel: 30,
      parentId: "twin",
      children: ["octoTank"],
      weaponPattern: "quadTank",
      themeColor: "#b8f28e",
      description: "Four-direction fire for area control.",
      statModifiers: { reload: 1.08 },
      tags: ["control", "spread"],
      icon: { body: "circle", barrels: iconRadial(4, 30, 11) }
    }),
    twinFlank: classNode({
      id: "twinFlank",
      name: "Twin Flank",
      unlockLevel: 30,
      parentId: "flankGuard",
      children: ["tripleTwin"],
      weaponPattern: "twinFlank",
      themeColor: "#ff8c8c",
      description: "Twin fire front and rear.",
      statModifiers: { reload: 1.12 },
      tags: ["control", "spread"],
      icon: {
        body: "circle",
        barrels: [
          { angle: -0.1, length: 30, width: 11 },
          { angle: 0.1, length: 30, width: 11 },
          { angle: PI - 0.1, length: 30, width: 11 },
          { angle: PI + 0.1, length: 30, width: 11 }
        ]
      }
    }),
    triAngle: classNode({
      id: "triAngle",
      name: "Tri-Angle",
      unlockLevel: 30,
      parentId: "flankGuard",
      children: ["booster", "fighter"],
      weaponPattern: "triAngle",
      themeColor: "#8de8e2",
      description: "Forward pressure with rear booster fire.",
      statModifiers: { reload: 0.95, moveSpeed: 1.04 },
      tags: ["duel", "spread"],
      icon: { body: "circle", barrels: iconSpread([0, (PI * 3) / 4, (-PI * 3) / 4], 31, 11) }
    }),
    assassin: classNode({
      id: "assassin",
      name: "Assassin",
      unlockLevel: 30,
      parentId: "sniper",
      children: ["stalker"],
      weaponPattern: "assassin",
      themeColor: "#8de8e2",
      description: "Longer range sniper branch.",
      statModifiers: { damage: 1.35, bulletSpeed: 1.4, reload: 1.28, bulletTtl: 1.25 },
      tags: ["range"],
      icon: { body: "circle", barrels: [{ angle: 0, length: 54, width: 10 }] }
    }),
    overseer: classNode({
      id: "overseer",
      name: "Overseer",
      unlockLevel: 30,
      parentId: "sniper",
      children: ["overlord", "necromancer"],
      weaponPattern: "none",
      droneLoadoutId: "overseer",
      themeColor: "#b8f28e",
      description: "Commands two drones. Hold fire to send them forward.",
      statModifiers: { maxHp: 0.95, moveSpeed: 0.96, reload: 1.06 },
      tags: ["control"],
      icon: { body: "circle", barrels: iconSpread([-0.2, 0.2], 34, 11) }
    }),
    hunter: classNode({
      id: "hunter",
      name: "Hunter",
      unlockLevel: 30,
      parentId: "sniper",
      children: ["predator", "streamliner"],
      weaponPattern: "hunter",
      themeColor: "#ff8c8c",
      description: "Stacked forward sniper barrels.",
      statModifiers: { reload: 1.22 },
      tags: ["range", "duel"],
      icon: { body: "circle", barrels: [{ angle: -0.05, length: 48, width: 10 }, { angle: 0.05, length: 36, width: 9 }] }
    }),
    destroyer: classNode({
      id: "destroyer",
      name: "Destroyer",
      unlockLevel: 30,
      parentId: "machineGun",
      children: ["annihilator", "hybrid"],
      weaponPattern: "destroyer",
      themeColor: "#8de8e2",
      description: "Slow heavy cannon with high burst.",
      statModifiers: { damage: 2.85, bulletSpeed: 0.72, reload: 2.05, projectileRadius: 1.65 },
      tags: ["duel"],
      icon: { body: "circle", barrels: [{ angle: 0, length: 44, width: 24 }] }
    }),
    gunner: classNode({
      id: "gunner",
      name: "Gunner",
      unlockLevel: 30,
      parentId: "machineGun",
      children: ["autoGunner", "sprayer"],
      weaponPattern: "gunner",
      themeColor: "#b8f28e",
      description: "Many small forward bullets.",
      statModifiers: { reload: 0.82 },
      tags: ["farm", "duel"],
      icon: { body: "circle", barrels: iconSpread([-0.1, -0.03, 0.03, 0.1], 31, 8) }
    }),
    triplet: classNode({
      id: "triplet",
      name: "Triplet",
      unlockLevel: 45,
      parentId: "tripleShot",
      children: [],
      weaponPattern: "triplet",
      themeColor: "#8de8e2",
      description: "Focused triple barrel final form.",
      statModifiers: { reload: 0.98 },
      tags: ["duel"],
      icon: { body: "circle", barrels: iconSpread([-0.08, 0, 0.08], 36, 11) }
    }),
    pentaShot: classNode({
      id: "pentaShot",
      name: "Penta Shot",
      unlockLevel: 45,
      parentId: "tripleShot",
      children: [],
      weaponPattern: "pentaShot",
      themeColor: "#b8f28e",
      description: "Wide five-shot spread.",
      statModifiers: { reload: 1.14 },
      tags: ["spread", "farm"],
      icon: { body: "circle", barrels: iconSpread([-0.48, -0.24, 0, 0.24, 0.48], 31, 9) }
    }),
    octoTank: classNode({
      id: "octoTank",
      name: "Octo Tank",
      unlockLevel: 45,
      parentId: "quadTank",
      children: [],
      weaponPattern: "octoTank",
      themeColor: "#8de8e2",
      description: "Eight-direction coverage.",
      statModifiers: { reload: 1.18 },
      tags: ["control", "spread"],
      icon: { body: "circle", barrels: iconRadial(8, 28, 8) }
    }),
    tripleTwin: classNode({
      id: "tripleTwin",
      name: "Triple Twin",
      unlockLevel: 45,
      parentId: "twinFlank",
      children: [],
      weaponPattern: "tripleTwin",
      themeColor: "#b8f28e",
      description: "Three twin axes for coverage.",
      statModifiers: { reload: 1.1 },
      tags: ["control", "spread"],
      icon: { body: "circle", barrels: iconSpread([0, PI, (PI * 2) / 3, (-PI) / 3, (-PI * 2) / 3, PI / 3], 28, 8) }
    }),
    stalker: classNode({
      id: "stalker",
      name: "Stalker",
      unlockLevel: 45,
      parentId: "assassin",
      children: [],
      weaponPattern: "stalker",
      themeColor: "#8de8e2",
      description: "Extreme sniper with long-lived bullets.",
      statModifiers: { damage: 1.55, bulletSpeed: 1.42, reload: 1.42, bulletTtl: 1.35 },
      tags: ["range"],
      icon: { body: "circle", barrels: [{ angle: 0, length: 60, width: 9 }] }
    }),
    overlord: classNode({
      id: "overlord",
      name: "Overlord",
      unlockLevel: 45,
      parentId: "overseer",
      children: [],
      weaponPattern: "none",
      droneLoadoutId: "overlord",
      themeColor: "#8de8e2",
      description: "Four command drones for heavy space control.",
      statModifiers: { maxHp: 0.98, moveSpeed: 0.93, reload: 1.0 },
      tags: ["control"],
      icon: { body: "circle", barrels: iconRadial(4, 31, 10) }
    }),
    necromancer: classNode({
      id: "necromancer",
      name: "Necromancer",
      unlockLevel: 45,
      parentId: "overseer",
      children: ["hiveLord"],
      weaponPattern: "none",
      droneLoadoutId: "necromancer",
      themeColor: "#b8f28e",
      description: "Converts killed shapes into a temporary drone swarm.",
      statModifiers: { maxHp: 0.92, moveSpeed: 0.94, bodyDamage: 0.95, reload: 1.12 },
      tags: ["control", "farm"],
      icon: { body: "diamond", barrels: iconRadial(6, 27, 8) }
    }),
    booster: classNode({
      id: "booster",
      name: "Booster",
      unlockLevel: 45,
      parentId: "triAngle",
      children: [],
      weaponPattern: "booster",
      themeColor: "#8de8e2",
      description: "Fast triangle final with rear booster fire.",
      statModifiers: { reload: 0.9, moveSpeed: 1.08 },
      tags: ["duel", "mobility"],
      icon: { body: "circle", barrels: iconSpread([0, (PI * 3) / 4, (-PI * 3) / 4], 33, 10) }
    }),
    fighter: classNode({
      id: "fighter",
      name: "Fighter",
      unlockLevel: 45,
      parentId: "triAngle",
      children: ["comet"],
      weaponPattern: "fighter",
      themeColor: "#b8f28e",
      description: "Mobile crossfire final with forward and booster shots.",
      statModifiers: { reload: 0.86, moveSpeed: 1.06 },
      tags: ["duel", "spread", "mobility"],
      icon: { body: "circle", barrels: iconSpread([0, -0.48, 0.48, (PI * 3) / 4, (-PI * 3) / 4], 28, 8) }
    }),
    predator: classNode({
      id: "predator",
      name: "Predator",
      unlockLevel: 45,
      parentId: "hunter",
      children: [],
      weaponPattern: "predator",
      themeColor: "#8de8e2",
      description: "Long-range hunter final with very fast bullets.",
      statModifiers: { damage: 1.55, bulletSpeed: 1.48, reload: 1.55, bulletTtl: 1.35 },
      tags: ["range"],
      icon: { body: "circle", barrels: [{ angle: 0, length: 62, width: 10 }] }
    }),
    streamliner: classNode({
      id: "streamliner",
      name: "Streamliner",
      unlockLevel: 45,
      parentId: "hunter",
      children: [],
      weaponPattern: "streamliner",
      themeColor: "#b8f28e",
      description: "Five stacked forward shots for steady pressure.",
      statModifiers: { reload: 0.92, bulletSpeed: 1.08 },
      tags: ["range", "duel"],
      icon: { body: "circle", barrels: iconSpread([-0.06, -0.03, 0, 0.03, 0.06], 38, 7) }
    }),
    annihilator: classNode({
      id: "annihilator",
      name: "Annihilator",
      unlockLevel: 45,
      parentId: "destroyer",
      children: ["siegeCore"],
      weaponPattern: "annihilator",
      themeColor: "#8de8e2",
      description: "Massive slow shell with extreme burst damage.",
      statModifiers: { damage: 3.55, bulletSpeed: 0.65, reload: 2.35, projectileRadius: 1.9 },
      tags: ["duel"],
      icon: { body: "circle", barrels: [{ angle: 0, length: 47, width: 28 }] }
    }),
    hybrid: classNode({
      id: "hybrid",
      name: "Hybrid",
      unlockLevel: 45,
      parentId: "destroyer",
      children: [],
      weaponPattern: "hybrid",
      themeColor: "#b8f28e",
      description: "Heavy cannon with two small escort pellets.",
      statModifiers: { damage: 2.55, bulletSpeed: 0.76, reload: 2.15, projectileRadius: 1.55 },
      tags: ["duel", "control"],
      icon: { body: "circle", barrels: iconSpread([0, -0.18, 0.18], 39, 13) }
    }),
    autoGunner: classNode({
      id: "autoGunner",
      name: "Auto Gunner",
      unlockLevel: 45,
      parentId: "gunner",
      children: [],
      weaponPattern: "autoGunner",
      themeColor: "#8de8e2",
      description: "Dense forward micro-bullets for dueling.",
      statModifiers: { reload: 0.72, bulletSpeed: 1.02 },
      tags: ["duel", "farm"],
      icon: { body: "circle", barrels: iconSpread([-0.12, -0.04, 0, 0.04, 0.12], 30, 7) }
    }),
    sprayer: classNode({
      id: "sprayer",
      name: "Sprayer",
      unlockLevel: 45,
      parentId: "gunner",
      children: ["stormcaller"],
      weaponPattern: "sprayer",
      themeColor: "#b8f28e",
      description: "Wide rapid spray for farming and suppression.",
      statModifiers: { reload: 0.82, bulletSpeed: 0.98 },
      tags: ["spread", "farm"],
      icon: { body: "circle", barrels: iconSpread([-0.34, -0.22, -0.1, 0, 0.1, 0.22, 0.34], 27, 7) }
    }),
    fireworkTank: classNode({
      id: "fireworkTank",
      name: "Firework Tank",
      unlockLevel: 30,
      parentId: "machineGun",
      children: ["starburst"],
      weaponPattern: "fireworkRocket",
      themeColor: "#ffb86c",
      description: "Launches a slow rocket that bursts into sparks.",
      statModifiers: { damage: 0.9, bulletSpeed: 0.82, reload: 1.18, projectileRadius: 1.18, recoilMultiplier: 1.15 },
      tags: ["explosive", "farm"],
      icon: { body: "circle", barrels: [{ angle: 0, length: 38, width: 20 }] }
    }),
    starburst: classNode({
      id: "starburst",
      name: "Starburst",
      unlockLevel: 45,
      parentId: "fireworkTank",
      children: ["missileCommand"],
      weaponPattern: "starburstRocket",
      themeColor: "#ff8c42",
      description: "Heavy rocket final that bursts into a wide spark star.",
      statModifiers: { damage: 1.05, bulletSpeed: 0.78, reload: 1.28, projectileRadius: 1.3, recoilMultiplier: 1.25 },
      tags: ["explosive", "spread"],
      icon: { body: "circle", barrels: [{ angle: 0, length: 42, width: 22 }] }
    }),
    trapper: classNode({
      id: "trapper",
      name: "Trapper",
      unlockLevel: 30,
      parentId: "sniper",
      children: ["minefield"],
      weaponPattern: "trapShot",
      themeColor: "#cdb4ff",
      description: "Places slow traps that arm and punish contact.",
      statModifiers: { damage: 0.85, bulletSpeed: 0.48, reload: 1.25, projectileRadius: 1.25 },
      tags: ["trap", "control"],
      icon: { body: "circle", barrels: [{ angle: 0, length: 34, width: 18 }] }
    }),
    minefield: classNode({
      id: "minefield",
      name: "Minefield",
      unlockLevel: 45,
      parentId: "trapper",
      children: ["aegisBastion"],
      weaponPattern: "tripleTrap",
      themeColor: "#a78bfa",
      description: "Places three traps to control space.",
      statModifiers: { damage: 0.75, bulletSpeed: 0.42, reload: 1.38, projectileRadius: 1.22 },
      tags: ["trap", "control"],
      icon: { body: "circle", barrels: iconSpread([-0.18, 0, 0.18], 31, 13) }
    }),
    rammer: classNode({
      id: "rammer",
      name: "Rammer",
      unlockLevel: 30,
      parentId: "flankGuard",
      children: ["spike"],
      weaponPattern: "weakNoseShot",
      themeColor: "#ffd166",
      description: "Fast body-damage tank with only a weak nose shot.",
      statModifiers: { damage: 0.55, reload: 1.45, moveSpeed: 1.14, maxHp: 1.18, bodyDamage: 1.65, bodyResistance: 0.78 },
      tags: ["ram", "body"],
      icon: { body: "diamond", barrels: [{ angle: 0, length: 25, width: 10 }] }
    }),
    spike: classNode({
      id: "spike",
      name: "Spike",
      unlockLevel: 45,
      parentId: "rammer",
      children: [],
      weaponPattern: "tinySpikeShot",
      themeColor: "#ffee93",
      description: "Heavy ramming final with high body damage and resistance.",
      statModifiers: { damage: 0.35, reload: 1.8, moveSpeed: 1.2, maxHp: 1.32, bodyDamage: 2.25, bodyResistance: 0.68, radius: 1.08 },
      tags: ["ram", "body"],
      icon: { body: "diamond", barrels: [{ angle: 0, length: 20, width: 9 }] }
    }),
    missileCommand: classNode({
      id: "missileCommand",
      name: "Missile Command",
      unlockLevel: 60,
      parentId: "starburst",
      children: [],
      weaponPattern: "missileCommand",
      themeColor: "#ff7a3d",
      description: "Launches guided missile salvos that burst into sparks.",
      statModifiers: { moveSpeed: 0.94, reload: 1.38, bulletSpeed: 0.72, bulletTtl: 1.1, projectileRadius: 1.22, recoilMultiplier: 1.1 },
      tags: ["explosive", "duel", "control"],
      icon: { body: "hex", barrels: iconSpread([-0.16, 0, 0.16], 46, 17) }
    }),
    stormcaller: classNode({
      id: "stormcaller",
      name: "Stormcaller",
      unlockLevel: 60,
      parentId: "sprayer",
      children: [],
      weaponPattern: "stormcaller",
      themeColor: "#80ffdb",
      description: "Creates a rotating storm of low-damage bullets.",
      statModifiers: { maxHp: 0.96, moveSpeed: 0.96, reload: 0.92, bulletSpeed: 0.96, bulletTtl: 0.92, projectileRadius: 0.92 },
      tags: ["spread", "farm", "control"],
      icon: { body: "hex", barrels: iconSpread([-0.62, -0.42, -0.24, -0.08, 0.08, 0.24, 0.42, 0.62], 28, 6) }
    }),
    siegeCore: classNode({
      id: "siegeCore",
      name: "Siege Core",
      unlockLevel: 60,
      parentId: "annihilator",
      children: [],
      weaponPattern: "siegeCore",
      themeColor: "#ffb703",
      description: "Fires one enormous slow siege shell.",
      statModifiers: { maxHp: 1.06, moveSpeed: 0.9, damage: 4.15, bulletSpeed: 0.58, reload: 2.65, bulletTtl: 1.05, projectileRadius: 2.15, recoilMultiplier: 1.45 },
      tags: ["duel", "burst"],
      icon: { body: "square", barrels: [{ angle: 0, length: 56, width: 34 }] }
    }),
    hiveLord: classNode({
      id: "hiveLord",
      name: "Hive Lord",
      unlockLevel: 60,
      parentId: "necromancer",
      children: [],
      weaponPattern: "none",
      droneLoadoutId: "hiveLord",
      themeColor: "#f6d365",
      description: "Commands a larger temporary drone swarm.",
      statModifiers: { maxHp: 0.9, moveSpeed: 0.91, bodyDamage: 0.9, reload: 1.0 },
      tags: ["control", "farm"],
      icon: { body: "diamond", barrels: iconRadial(8, 27, 7) }
    }),
    aegisBastion: classNode({
      id: "aegisBastion",
      name: "Aegis Bastion",
      unlockLevel: 60,
      parentId: "minefield",
      children: [],
      weaponPattern: "aegisBastion",
      themeColor: "#c4b5fd",
      description: "Places a wider wall of bullet-blocking traps.",
      statModifiers: { maxHp: 1.04, moveSpeed: 0.92, damage: 0.68, bulletSpeed: 0.38, reload: 1.5, projectileRadius: 1.28 },
      tags: ["trap", "control"],
      icon: { body: "diamond", barrels: iconSpread([-0.34, -0.17, 0, 0.17, 0.34], 34, 12) }
    }),
    comet: classNode({
      id: "comet",
      name: "Comet",
      unlockLevel: 60,
      parentId: "fighter",
      children: [],
      weaponPattern: "comet",
      themeColor: "#ffee93",
      description: "High-speed striker with brutal booster thrust.",
      statModifiers: { maxHp: 0.88, moveSpeed: 1.12, bodyDamage: 1.05, reload: 0.82, bulletSpeed: 1.04, bulletTtl: 0.95, projectileRadius: 0.95 },
      tags: ["duel", "mobility"],
      icon: { body: "triangle", barrels: iconSpread([0, -0.42, 0.42, 2.35, -2.35, PI], 29, 7) }
    })
  }
};

export const TANK_CLASS_CONFIG = deepFreeze(classConfig);

export function validateTankClassConfig(config = TANK_CLASS_CONFIG) {
  const issues = [];
  const classes = config.classes ?? {};
  const emptyPatternsAllowedForDroneClasses = new Set(
    Object.values(classes)
      .filter((tankClass) => Boolean(tankClass.droneLoadoutId))
      .map((tankClass) => tankClass.weaponPattern)
  );

  if (!classes[config.defaultClassId]) {
    issues.push("Default tank class is missing.");
  }

  for (const [id, tankClass] of Object.entries(classes)) {
    if (id !== tankClass.id) {
      issues.push(`Class key ${id} must match id ${tankClass.id}.`);
    }
    if (!config.levels.includes(tankClass.unlockLevel)) {
      issues.push(`Class ${id} has invalid unlock level.`);
    }
    if (!config.weaponPatterns[tankClass.weaponPattern]) {
      issues.push(`Class ${id} references missing weapon pattern ${tankClass.weaponPattern}.`);
    }
    if (tankClass.droneLoadoutId && !DRONE_CONFIG.loadouts[tankClass.droneLoadoutId]) {
      issues.push(`Class ${id} references missing drone loadout ${tankClass.droneLoadoutId}.`);
    }
    if (!tankClass.droneLoadoutId && tankClass.weaponPattern === "none") {
      issues.push(`Class ${id} cannot use no-shot weapon pattern without a drone loadout.`);
    }
    if (tankClass.parentId && !classes[tankClass.parentId]) {
      issues.push(`Class ${id} references missing parent ${tankClass.parentId}.`);
    }
    for (const childId of tankClass.children) {
      const child = classes[childId];
      if (!child) {
        issues.push(`Class ${id} references missing child ${childId}.`);
        continue;
      }
      if (child.parentId !== id) {
        issues.push(`Class ${childId} parentId must be ${id}.`);
      }
      if (child.unlockLevel <= tankClass.unlockLevel) {
        issues.push(`Class ${childId} must unlock after ${id}.`);
      }
    }
    if (hasCycle(id, classes)) {
      issues.push(`Class ${id} has a cyclic parent chain.`);
    }
    if (tankClass.active !== true) {
      issues.push(`Class ${id} must be active in the full tree pass.`);
    }
    for (const key of ["damage", "bulletSpeed", "reload", "moveSpeed", "bulletTtl", "projectileRadius", "maxHp", "radius", "bodyDamage", "bodyResistance", "recoilMultiplier"]) {
      const value = tankClass.statModifiers?.[key];
      if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
        issues.push(`Class ${id} has invalid stat modifier ${key}.`);
      }
    }
    if (!Array.isArray(tankClass.botTags) || tankClass.botTags.length === 0) {
      issues.push(`Class ${id} must define botTags.`);
    }
    if (!TANK_CLASS_BALANCE_ROLES.includes(tankClass.balanceRole)) {
      issues.push(`Class ${id} has invalid balance role ${tankClass.balanceRole}.`);
    }
    for (const key of ["focusedDpsMin", "focusedDpsMax", "totalDpsMin", "totalDpsMax"]) {
      const value = tankClass.balanceBudget?.[key];
      if (!Number.isFinite(Number(value)) || Number(value) < 0) {
        issues.push(`Class ${id} has invalid balance budget ${key}.`);
      }
    }
    if ((tankClass.balanceBudget?.focusedDpsMax ?? 0) < (tankClass.balanceBudget?.focusedDpsMin ?? 0)) {
      issues.push(`Class ${id} focused DPS budget max must be >= min.`);
    }
    if ((tankClass.balanceBudget?.totalDpsMax ?? 0) < (tankClass.balanceBudget?.totalDpsMin ?? 0)) {
      issues.push(`Class ${id} total DPS budget max must be >= min.`);
    }
    validateIconSchema(id, tankClass.icon, issues);
  }

  for (const [patternId, pattern] of Object.entries(config.weaponPatterns ?? {})) {
    if (!Array.isArray(pattern) || pattern.length === 0) {
      if (!emptyPatternsAllowedForDroneClasses.has(patternId)) {
        issues.push(`Weapon pattern ${patternId} must contain at least one shot unless used by a drone class.`);
      }
      continue;
    }
    if (pattern.length > 8) {
      issues.push(`Weapon pattern ${patternId} cannot exceed 8 shots.`);
    }
    for (const [index, shotConfig] of pattern.entries()) {
      for (const key of ["angleOffset", "lateralOffset", "damageMultiplier", "speedMultiplier", "recoilWeight"]) {
        const value = shotConfig[key];
        if (!Number.isFinite(Number(value)) || (["damageMultiplier", "speedMultiplier", "recoilWeight"].includes(key) && Number(value) <= 0)) {
          issues.push(`Weapon pattern ${patternId}[${index}] has invalid ${key}.`);
        }
      }
      const delayMs = Number(shotConfig.delayMs ?? 0);
      if (!Number.isInteger(delayMs) || delayMs < 0 || delayMs > 260) {
        issues.push(`Weapon pattern ${patternId}[${index}] has invalid delayMs.`);
      }
      if (!["front", "rear", "side", "radial", "heavy", "trap", "low"].includes(shotConfig.recoilRole)) {
        issues.push(`Weapon pattern ${patternId}[${index}] has invalid recoilRole ${shotConfig.recoilRole}.`);
      }
    }
  }

  return issues;
}

export function getPublicTankClassConfig(config = TANK_CLASS_CONFIG) {
  return {
    defaultClassId: config.defaultClassId,
    maxSelectableLevel: config.maxSelectableLevel,
    levels: config.levels,
    classes: config.classes
  };
}

function classNode({
  id,
  name,
  unlockLevel,
  parentId,
  children,
  weaponPattern,
  droneLoadoutId = null,
  themeColor,
  description,
  statModifiers = {},
  tags,
  icon,
  balanceRole,
  balanceBudget
}) {
  const role = balanceRole ?? CLASS_BALANCE_ROLES[id] ?? inferBalanceRole({ tags, weaponPattern });
  return {
    id,
    name,
    unlockLevel,
    parentId,
    children,
    weaponPattern,
    droneLoadoutId,
    themeColor,
    description,
    active: true,
    statModifiers: {
      damage: 1,
      bulletSpeed: 1,
      reload: 1,
      moveSpeed: 1,
      bulletTtl: 1,
      projectileRadius: 1,
      maxHp: 1,
      radius: 1,
      bodyDamage: 1,
      bodyResistance: 1,
      recoilMultiplier: 1,
      ...statModifiers
    },
    botTags: tags,
    icon: normalizeTankIcon(id, icon),
    balanceRole: role,
    balanceBudget: {
      ...ROLE_BUDGETS[role],
      ...(balanceBudget ?? {})
    }
  };
}

function shot(angleOffset, lateralOffset, damageMultiplier, speedMultiplier, options = {}) {
  const recoilRole = options.recoilRole ?? inferRecoilRole(angleOffset);
  return {
    angleOffset,
    lateralOffset,
    damageMultiplier,
    speedMultiplier,
    recoilRole,
    recoilWeight: options.recoilWeight ?? options.recoilMultiplier ?? defaultRecoilWeight(recoilRole, options.kind),
    delayMs: options.delayMs ?? 0,
    ...options
  };
}

function spread(angles, damageMultiplier, speedMultiplier) {
  return angles.map((angleOffset) => shot(angleOffset, 0, damageMultiplier, speedMultiplier));
}

function radial(count, damageMultiplier, speedMultiplier) {
  return Array.from({ length: count }, (_, index) => shot((PI * 2 * index) / count, 0, damageMultiplier, speedMultiplier));
}

function iconSpread(angles, length, width) {
  return angles.map((angle) => ({ angle, length, width }));
}

function iconRadial(count, length, width) {
  return Array.from({ length: count }, (_, index) => ({ angle: (PI * 2 * index) / count, length, width }));
}

function budget(focusedDpsMin, focusedDpsMax, totalDpsMin, totalDpsMax) {
  return { focusedDpsMin, focusedDpsMax, totalDpsMin, totalDpsMax };
}

function accent(type, angle, size = 0.5, offset = 0.9) {
  return { type, angle, size, offset };
}

function styledBarrels(barrels, style) {
  return barrels.map((barrel) => ({ ...barrel, style }));
}

function inferRecoilRole(angleOffset = 0) {
  const angle = Math.abs(normalizeAngle(angleOffset));
  if (angle <= 0.55) {
    return "front";
  }
  if (Math.abs(PI - angle) <= 0.55 || angle >= 2.35) {
    return "rear";
  }
  if (angle >= 1.0 && angle <= 2.15) {
    return "side";
  }
  return "radial";
}

function defaultRecoilWeight(recoilRole, kind) {
  if (kind === "trap" || recoilRole === "trap") {
    return 0.55;
  }
  if (recoilRole === "heavy") {
    return 1.15;
  }
  if (recoilRole === "low") {
    return 0.35;
  }
  return 1;
}

function normalizeAngle(angle) {
  let value = Number(angle) || 0;
  while (value > PI) {
    value -= PI * 2;
  }
  while (value < -PI) {
    value += PI * 2;
  }
  return value;
}

function normalizeTankIcon(classId, icon = {}) {
  const override = CLASS_VISUAL_OVERRIDES[classId] ?? {};
  const merged = {
    body: "circle",
    bodyScale: 1,
    ring: "none",
    core: "none",
    accents: [],
    barrels: [],
    ...icon,
    ...override
  };
  if (!override.accents && icon.accents) {
    merged.accents = icon.accents;
  }
  if (!override.barrels && icon.barrels) {
    merged.barrels = icon.barrels;
  }
  return {
    body: TANK_CLASS_ICON_BODIES.includes(merged.body) ? merged.body : "circle",
    bodyScale: finitePositive(merged.bodyScale, 1),
    ring: TANK_CLASS_ICON_RINGS.includes(merged.ring) ? merged.ring : "none",
    core: TANK_CLASS_ICON_CORES.includes(merged.core) ? merged.core : "none",
    accents: normalizeAccents(merged.accents),
    barrels: normalizeBarrels(merged.barrels)
  };
}

function normalizeBarrels(barrels) {
  const safeBarrels = Array.isArray(barrels) && barrels.length > 0
    ? barrels
    : [{ angle: 0, length: 34, width: 14, style: "standard" }];
  return safeBarrels.map((barrel) => ({
    angle: finiteNumber(barrel.angle, 0),
    length: finitePositive(barrel.length, 30),
    width: finitePositive(barrel.width, 12),
    style: TANK_CLASS_BARREL_STYLES.includes(barrel.style) ? barrel.style : "standard"
  }));
}

function normalizeAccents(accents) {
  if (!Array.isArray(accents)) {
    return [];
  }
  return accents
    .filter((item) => TANK_CLASS_ACCENT_TYPES.includes(item?.type))
    .map((item) => ({
      type: item.type,
      angle: finiteNumber(item.angle, 0),
      size: finitePositive(item.size, 0.5),
      offset: finitePositive(item.offset, 0.9)
    }));
}

function validateIconSchema(classId, icon, issues) {
  if (!icon || typeof icon !== "object") {
    issues.push(`Class ${classId} must define an icon.`);
    return;
  }
  if (!TANK_CLASS_ICON_BODIES.includes(icon.body)) {
    issues.push(`Class ${classId} has invalid icon body ${icon.body}.`);
  }
  if (!TANK_CLASS_ICON_RINGS.includes(icon.ring)) {
    issues.push(`Class ${classId} has invalid icon ring ${icon.ring}.`);
  }
  if (!TANK_CLASS_ICON_CORES.includes(icon.core)) {
    issues.push(`Class ${classId} has invalid icon core ${icon.core}.`);
  }
  if (!Number.isFinite(Number(icon.bodyScale)) || Number(icon.bodyScale) <= 0) {
    issues.push(`Class ${classId} has invalid icon bodyScale.`);
  }
  if (!Array.isArray(icon.barrels) || icon.barrels.length === 0) {
    issues.push(`Class ${classId} must define at least one icon barrel.`);
  }
  for (const barrel of icon.barrels ?? []) {
    if (!TANK_CLASS_BARREL_STYLES.includes(barrel.style)) {
      issues.push(`Class ${classId} has invalid barrel style ${barrel.style}.`);
    }
    if (!Number.isFinite(Number(barrel.length)) || Number(barrel.length) <= 0) {
      issues.push(`Class ${classId} has invalid barrel length.`);
    }
    if (!Number.isFinite(Number(barrel.width)) || Number(barrel.width) <= 0) {
      issues.push(`Class ${classId} has invalid barrel width.`);
    }
  }
  for (const accent of icon.accents ?? []) {
    if (!TANK_CLASS_ACCENT_TYPES.includes(accent.type)) {
      issues.push(`Class ${classId} has invalid accent type ${accent.type}.`);
    }
  }
}

function inferBalanceRole({ tags = [], weaponPattern }) {
  if (tags.includes("body") || tags.includes("ram")) {
    return "body";
  }
  if (tags.includes("trap")) {
    return "trap";
  }
  if (tags.includes("explosive")) {
    return "rocket";
  }
  if (tags.includes("mobility")) {
    return "mobility";
  }
  if (tags.includes("range")) {
    return "range";
  }
  if (tags.includes("control")) {
    return "control";
  }
  if (tags.includes("spread")) {
    return "spread";
  }
  if (weaponPattern === "single") {
    return "starter";
  }
  return "sustain";
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function finitePositive(value, fallback) {
  const number = finiteNumber(value, fallback);
  return number > 0 ? number : fallback;
}

function hasCycle(id, classes) {
  const visited = new Set();
  let current = classes[id];
  while (current?.parentId) {
    if (visited.has(current.parentId)) {
      return true;
    }
    visited.add(current.parentId);
    current = classes[current.parentId];
  }
  return false;
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
