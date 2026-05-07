import { COMBAT_FEEDBACK_CONFIG, getCombatCauseConfig } from "../config/combatFeedbackConfig.js";

export const DAMAGE_CAUSES = Object.freeze({
  BULLET: "bullet",
  ROCKET: "rocket",
  SPARK: "spark",
  TRAP: "trap",
  DRONE: "drone",
  TANK_CONTACT: "tankContact",
  SHAPE_CONTACT: "shapeContact",
  ALPHA_CONTACT: "alphaContact",
  UNKNOWN: "unknown"
});

const CONTACT_CAUSES = new Set([
  DAMAGE_CAUSES.TANK_CONTACT,
  DAMAGE_CAUSES.SHAPE_CONTACT,
  DAMAGE_CAUSES.ALPHA_CONTACT
]);

export function getDamageCause(source) {
  if (!source) {
    return DAMAGE_CAUSES.UNKNOWN;
  }
  if (isKnownCause(source.damageCause)) {
    return source.damageCause;
  }
  if (source.kind === "contact" || source.behavior === "contact" || source.type === "contact") {
    if (source.ownerKind === "tank" || source.ownerKind === "player" || source.ownerKind === "bot") {
      return DAMAGE_CAUSES.TANK_CONTACT;
    }
    if (source.ownerKind === "shape" && (source.ownerShapeType === "alphaPentagon" || source.ownerIsCenterObjective)) {
      return DAMAGE_CAUSES.ALPHA_CONTACT;
    }
    return DAMAGE_CAUSES.SHAPE_CONTACT;
  }
  if (source.kind === "trap" || source.behavior === "trap") {
    return DAMAGE_CAUSES.TRAP;
  }
  if (source.kind === "drone" || source.behavior === "drone" || source.type === "drone") {
    return DAMAGE_CAUSES.DRONE;
  }
  if (source.kind === "rocket") {
    return DAMAGE_CAUSES.ROCKET;
  }
  if (source.kind === "spark") {
    return DAMAGE_CAUSES.SPARK;
  }
  if (source.kind === "bullet" || source.behavior === "bullet") {
    return DAMAGE_CAUSES.BULLET;
  }
  return DAMAGE_CAUSES.UNKNOWN;
}

export function isContactDamageCause(cause) {
  return CONTACT_CAUSES.has(cause);
}

export function createDamageSourceInfo({ source, target, amount = 0, timeMs = 0 } = {}) {
  const cause = getDamageCause(source);
  const causeConfig = getCombatCauseConfig(cause);
  const sourceName = sanitizeSourceName(getSourceName(source, cause));
  const sourceX = finiteOr(source?.x, source?.prevX, target?.x, 0);
  const sourceY = finiteOr(source?.y, source?.prevY, target?.y, 0);
  const targetX = finiteOr(target?.x, sourceX, 0);
  const targetY = finiteOr(target?.y, sourceY, 0);
  return {
    amount: Math.max(0, Math.round(Number(amount) || 0)),
    cause,
    causeLabel: causeConfig.label,
    color: causeConfig.color,
    sourceId: String(source?.ownerId ?? source?.id ?? "world"),
    sourceName,
    sourceKind: String(source?.ownerKind ?? source?.type ?? source?.kind ?? "world"),
    sourceX,
    sourceY,
    targetX,
    targetY,
    timeMs: Math.round(Number(timeMs) || 0)
  };
}

export function formatDamageCause(info) {
  if (!info) {
    return getCombatCauseConfig(DAMAGE_CAUSES.UNKNOWN).label;
  }
  const label = info.causeLabel ?? getCombatCauseConfig(info.cause).label;
  if (info.cause === DAMAGE_CAUSES.BULLET || info.cause === DAMAGE_CAUSES.ROCKET || info.cause === DAMAGE_CAUSES.SPARK || info.cause === DAMAGE_CAUSES.TRAP || info.cause === DAMAGE_CAUSES.DRONE) {
    return info.sourceName && info.sourceName !== "world" ? `${info.sourceName}'s ${label}` : label;
  }
  return label;
}

function getSourceName(source, cause) {
  if (!source) {
    return "world";
  }
  if (cause === DAMAGE_CAUSES.ALPHA_CONTACT) {
    return "Alpha Pentagon";
  }
  if (cause === DAMAGE_CAUSES.SHAPE_CONTACT) {
    return source.ownerName ?? source.ownerShapeType ?? "shape";
  }
  return source.ownerName ?? source.name ?? source.ownerKind ?? "world";
}

function isKnownCause(cause) {
  return Object.values(DAMAGE_CAUSES).includes(cause);
}

function sanitizeSourceName(value) {
  return String(value ?? "world").trim().slice(0, 32) || "world";
}

function finiteOr(...values) {
  for (const value of values) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return Math.round(numeric * 10) / 10;
    }
  }
  return 0;
}
