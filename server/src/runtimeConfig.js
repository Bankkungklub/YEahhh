import { resolve } from "node:path";
import { APP_CONFIG } from "../../shared/config/appConfig.js";
import { GAME_CONFIG } from "../../shared/config/gameConfig.js";

const DEFAULTS = Object.freeze({
  maxWsClients: 160,
  wsHeartbeatMs: 25000,
  wsHeartbeatTimeoutMs: 10000,
  wsMessageRateLimit: 90,
  accountBackupIntervalMs: 21600000,
  accountBackupMaxFiles: 12,
  shutdownGraceMs: 8000
});

export function loadRuntimeConfig(env = process.env, {
  rootDir = process.cwd(),
  gameConfig = GAME_CONFIG,
  appConfig = APP_CONFIG
} = {}) {
  const nodeEnv = String(env.NODE_ENV || "development").trim() || "development";
  const production = nodeEnv === "production";
  const publicBaseUrl = normalizeOptionalUrl(env.PUBLIC_BASE_URL);
  const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS, publicBaseUrl);
  const debugEndpointsEnabled = readBoolean(
    env.DEBUG_ENDPOINTS,
    production ? false : true
  );

  return deepFreeze({
    nodeEnv,
    production,
    port: readInteger(env.PORT, gameConfig.server.port, { min: 1, max: 65535 }),
    publicBaseUrl,
    allowedOrigins,
    trustProxy: readBoolean(env.TRUST_PROXY, false),
    debugEndpointsEnabled: production ? debugEndpointsEnabled === true : debugEndpointsEnabled,
    sessionCookieSecure: readSessionCookieSecure(env.SESSION_COOKIE_SECURE, production),
    storage: {
      accountStorePath: resolve(rootDir, env.ACCOUNT_STORE_PATH || appConfig.storage.path)
    },
    websocket: {
      maxClients: readInteger(env.MAX_WS_CLIENTS, DEFAULTS.maxWsClients, { min: 1, max: 10000 }),
      heartbeatMs: readInteger(env.WS_HEARTBEAT_MS, DEFAULTS.wsHeartbeatMs, { min: 1000, max: 300000 }),
      heartbeatTimeoutMs: readInteger(env.WS_HEARTBEAT_TIMEOUT_MS, DEFAULTS.wsHeartbeatTimeoutMs, { min: 1000, max: 300000 }),
      messageRateLimit: readInteger(env.WS_MESSAGE_RATE_LIMIT, DEFAULTS.wsMessageRateLimit, { min: 5, max: 1000 })
    },
    backups: {
      intervalMs: readInteger(env.ACCOUNT_BACKUP_INTERVAL_MS, DEFAULTS.accountBackupIntervalMs, { min: 60000, max: 86400000 }),
      maxFiles: readInteger(env.ACCOUNT_BACKUP_MAX_FILES, DEFAULTS.accountBackupMaxFiles, { min: 1, max: 200 })
    },
    shutdownGraceMs: readInteger(env.SHUTDOWN_GRACE_MS, DEFAULTS.shutdownGraceMs, { min: 1000, max: 60000 })
  });
}

export function validateRuntimeConfig(runtime) {
  const issues = [];
  if (!runtime || typeof runtime !== "object") {
    return ["runtime config is missing."];
  }
  if (runtime.production && runtime.allowedOrigins.length === 0) {
    issues.push("production requires PUBLIC_BASE_URL or ALLOWED_ORIGINS.");
  }
  if (runtime.production && runtime.allowedOrigins.includes("*")) {
    issues.push("production cannot use wildcard ALLOWED_ORIGINS.");
  }
  if (!Number.isInteger(runtime.port) || runtime.port < 1 || runtime.port > 65535) {
    issues.push("PORT must be a valid TCP port.");
  }
  if (!runtime.storage?.accountStorePath) {
    issues.push("ACCOUNT_STORE_PATH resolved to an empty path.");
  }
  if (runtime.websocket.heartbeatTimeoutMs >= runtime.websocket.heartbeatMs) {
    issues.push("WS_HEARTBEAT_TIMEOUT_MS must be lower than WS_HEARTBEAT_MS.");
  }
  if (runtime.websocket.maxClients < 1) {
    issues.push("MAX_WS_CLIENTS must be positive.");
  }
  return issues;
}

export function assertValidRuntimeConfig(runtime) {
  const issues = validateRuntimeConfig(runtime);
  if (issues.length > 0) {
    throw new Error(`Invalid runtime config: ${issues.join(" ")}`);
  }
}

export function isProductionRuntime(runtime) {
  return runtime?.production === true || runtime?.nodeEnv === "production";
}

export function isOriginAllowed(origin, runtime) {
  const cleanOrigin = normalizeOptionalUrl(origin);
  if (!cleanOrigin) {
    return true;
  }
  const allowed = runtime?.allowedOrigins ?? [];
  if (allowed.length === 0 && !isProductionRuntime(runtime)) {
    return true;
  }
  return allowed.includes("*") || allowed.includes(cleanOrigin);
}

function parseAllowedOrigins(rawValue, publicBaseUrl) {
  const origins = new Set();
  if (publicBaseUrl) {
    origins.add(publicBaseUrl);
  }
  for (const part of String(rawValue || "").split(",")) {
    const origin = normalizeOptionalUrl(part);
    if (origin) {
      origins.add(origin);
    } else if (part.trim() === "*") {
      origins.add("*");
    }
  }
  return [...origins];
}

function normalizeOptionalUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const url = new URL(raw);
    return url.origin;
  } catch {
    return "";
  }
}

function readBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function readInteger(value, fallback, { min, max }) {
  const numeric = Number(value);
  const integer = Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
  return Math.max(min, Math.min(max, integer));
}

function readSessionCookieSecure(value, production) {
  const raw = String(value ?? "auto").trim().toLowerCase();
  if (raw === "auto" || raw === "") {
    return production;
  }
  return ["1", "true", "yes", "on"].includes(raw);
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
