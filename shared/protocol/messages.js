import { GAME_CONFIG, UPGRADE_KEYS } from "../config/gameConfig.js";
import { sanitizeClassId } from "../sim/tankClasses.js";

export const CLIENT_MESSAGES = Object.freeze({
  JOIN: "join",
  INPUT: "input",
  UPGRADE: "upgrade",
  SELECT_CLASS: "selectClass",
  RESPAWN: "respawn",
  PING: "ping"
});

export const SERVER_MESSAGES = Object.freeze({
  WELCOME: "welcome",
  SNAPSHOT: "snapshot",
  DAMAGE: "damage",
  DEATH: "death",
  ERROR: "error",
  PONG: "pong"
});

export function parseClientMessage(raw, config = GAME_CONFIG) {
  if (typeof raw !== "string" || raw.length > config.network.maxMessageBytes) {
    return { ok: false, error: "Invalid message size." };
  }

  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Malformed JSON." };
  }

  if (!message || typeof message.type !== "string") {
    return { ok: false, error: "Missing message type." };
  }

  switch (message.type) {
    case CLIENT_MESSAGES.JOIN:
      return {
        ok: true,
        message: {
          type: message.type,
          name: sanitizeName(message.name),
          roomId: sanitizeRoomId(message.roomId)
        }
      };
    case CLIENT_MESSAGES.INPUT:
      return { ok: true, message: sanitizeInputMessage(message) };
    case CLIENT_MESSAGES.UPGRADE:
      if (!UPGRADE_KEYS.includes(message.key)) {
        return { ok: false, error: "Invalid upgrade key." };
      }
      return { ok: true, message: { type: message.type, key: message.key } };
    case CLIENT_MESSAGES.SELECT_CLASS:
      {
        const classId = sanitizeClassId(message.classId);
        if (!classId) {
          return { ok: false, error: "Invalid class id." };
        }
        return { ok: true, message: { type: message.type, classId } };
      }
    case CLIENT_MESSAGES.RESPAWN:
      return { ok: true, message: { type: message.type } };
    case CLIENT_MESSAGES.PING:
      return { ok: true, message: { type: message.type, t: Number(message.t) || 0 } };
    default:
      return { ok: false, error: "Unknown message type." };
  }
}

export function sanitizeRoomId(roomId) {
  const clean = String(roomId ?? "")
    .replace(/[^\w\-.]/g, "")
    .trim()
    .slice(0, 48);
  return clean || "";
}

export function sanitizeName(name) {
  const clean = String(name ?? "")
    .replace(/[^\w \-.]/g, "")
    .trim()
    .slice(0, 16);
  return clean || "Tank";
}

export function sanitizeInputMessage(message) {
  return {
    type: CLIENT_MESSAGES.INPUT,
    seq: Math.max(0, Math.trunc(Number(message.seq) || 0)),
    moveX: clampUnit(message.moveX),
    moveY: clampUnit(message.moveY),
    aimAngle: normalizeAngle(message.aimAngle),
    fire: Boolean(message.fire)
  };
}

export function normalizeAngle(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  const twoPi = Math.PI * 2;
  return ((numeric % twoPi) + twoPi) % twoPi;
}

function clampUnit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, numeric));
}
