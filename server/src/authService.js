import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { APP_CONFIG } from "../../shared/config/appConfig.js";
import { clonePublicAccount, normalizeUsernameKey } from "./accountStore.js";

export class AuthService {
  constructor({ store, config = APP_CONFIG, now = () => Date.now(), runtime = null } = {}) {
    this.store = store;
    this.config = config;
    this.now = now;
    this.runtime = runtime;
    this.loginAttempts = new Map();
  }

  register({ username, password }) {
    const cleanUsername = sanitizeUsername(username, this.config);
    validateUsername(cleanUsername, this.config);
    validatePassword(password, this.config);
    if (this.store.getAccountByUsername(cleanUsername)) {
      const error = new Error("Username is already taken.");
      error.status = 409;
      throw error;
    }

    const salt = randomBytes(this.config.auth.passwordHash.saltBytes).toString("hex");
    const passwordHash = hashPassword(password, salt, this.config);
    const account = this.store.createAccount({
      username: cleanUsername,
      usernameKey: normalizeUsernameKey(cleanUsername),
      passwordHash,
      salt
    });
    const session = this.createSession(account.id);
    return { account, session };
  }

  login({ username, password, ip = "local" }) {
    this.checkRateLimit(ip);
    const account = this.store.getAccountByUsername(username);
    if (!account || !verifyPassword(password, account, this.config)) {
      const error = new Error("Invalid username or password.");
      error.status = 401;
      throw error;
    }
    const session = this.createSession(account.id);
    return { account: clonePublicAccount(account), session };
  }

  logout(token) {
    if (!token) {
      return false;
    }
    return this.store.deleteSession(hashToken(token));
  }

  createSession(accountId) {
    const token = randomBytes(32).toString("hex");
    const nowMs = this.now();
    const session = this.store.createSession({
      tokenHash: hashToken(token),
      accountId,
      createdAtMs: nowMs,
      expiresAtMs: nowMs + this.config.auth.sessionTtlMs
    });
    return { token, ...session };
  }

  getAccountForToken(token) {
    if (!token) {
      return null;
    }
    const session = this.store.getSessionByTokenHash(hashToken(token));
    if (!session) {
      return null;
    }
    return clonePublicAccount(this.store.getAccountById(session.accountId));
  }

  getAccountFromRequest(request) {
    const cookies = parseCookies(request.headers.cookie ?? "");
    return this.getAccountForToken(cookies[this.config.auth.sessionCookieName]);
  }

  getSessionTokenFromRequest(request) {
    const cookies = parseCookies(request.headers.cookie ?? "");
    return cookies[this.config.auth.sessionCookieName] ?? "";
  }

  createCookie(session) {
    const maxAge = Math.floor(this.config.auth.sessionTtlMs / 1000);
    return `${this.config.auth.sessionCookieName}=${session.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${this.getSecureCookieSuffix()}`;
  }

  createClearCookie() {
    return `${this.config.auth.sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${this.getSecureCookieSuffix()}`;
  }

  checkRateLimit(ip) {
    const nowMs = this.now();
    const windowMs = this.config.auth.loginRateLimitWindowMs;
    const current = this.loginAttempts.get(ip) ?? { count: 0, windowStartMs: nowMs };
    if (nowMs - current.windowStartMs > windowMs) {
      current.count = 0;
      current.windowStartMs = nowMs;
    }
    current.count += 1;
    this.loginAttempts.set(ip, current);
    if (current.count > this.config.auth.loginRateLimitMax) {
      const error = new Error("Too many login attempts. Try again soon.");
      error.status = 429;
      throw error;
    }
  }

  getSecureCookieSuffix() {
    return this.runtime?.sessionCookieSecure ? "; Secure" : "";
  }
}

export function sanitizeUsername(username, config = APP_CONFIG) {
  return String(username ?? "")
    .replace(/[^\w \-.]/g, "")
    .trim()
    .slice(0, config.auth.usernameMax);
}

export function validateUsername(username, config = APP_CONFIG) {
  if (username.length < config.auth.usernameMin) {
    const error = new Error(`Username must be at least ${config.auth.usernameMin} characters.`);
    error.status = 400;
    throw error;
  }
}

export function validatePassword(password, config = APP_CONFIG) {
  if (String(password ?? "").length < config.auth.passwordMin) {
    const error = new Error(`Password must be at least ${config.auth.passwordMin} characters.`);
    error.status = 400;
    throw error;
  }
}

export function hashPassword(password, salt, config = APP_CONFIG) {
  return scryptSync(
    String(password),
    salt,
    config.auth.passwordHash.keyLength
  ).toString("hex");
}

export function verifyPassword(password, account, config = APP_CONFIG) {
  const actual = Buffer.from(account.passwordHash, "hex");
  const expected = Buffer.from(hashPassword(password, account.salt, config), "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function parseCookies(header) {
  const cookies = {};
  for (const part of String(header ?? "").split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (!rawKey) {
      continue;
    }
    cookies[rawKey] = decodeURIComponent(rawValue.join("="));
  }
  return cookies;
}
