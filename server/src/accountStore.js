import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { APP_CONFIG } from "../../shared/config/appConfig.js";
import { getDefaultEquipped, getDefaultInventory, normalizeAccountCosmetics } from "../../shared/sim/cosmetics.js";

const STORE_VERSION = 1;

export class AccountStore {
  constructor({ filePath = APP_CONFIG.storage.path, config = APP_CONFIG, now = () => Date.now() } = {}) {
    this.filePath = resolve(filePath);
    this.config = config;
    this.now = now;
    this.data = {
      version: STORE_VERSION,
      nextAccountSerial: 1,
      accounts: [],
      sessions: []
    };
    this.load();
  }

  load() {
    mkdirSync(dirname(this.filePath), { recursive: true });
    if (!existsSync(this.filePath)) {
      this.save();
      return;
    }

    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8"));
      this.data = normalizeStoreData(parsed, this.config);
      this.save();
    } catch (error) {
      if (this.config.storage.backupCorruptFiles) {
        const backupPath = `${this.filePath}.corrupt.${this.now()}`;
        renameSync(this.filePath, backupPath);
      }
      this.data = normalizeStoreData({}, this.config);
      this.save();
    }
  }

  save() {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(this.data, null, 2)}\n`, "utf8");
    renameSync(tempPath, this.filePath);
  }

  createAccount({ username, usernameKey, passwordHash, salt, role = "player" }) {
    if (this.getAccountByUsername(username)) {
      return null;
    }
    const nowMs = this.now();
    const account = {
      id: `acct-${this.data.nextAccountSerial}`,
      username,
      usernameKey,
      passwordHash,
      salt,
      role: normalizeAccountRole(role),
      createdAtMs: nowMs,
      coins: this.config.shop.defaultCoins,
      inventory: getDefaultInventory(this.config),
      equipped: getDefaultEquipped(this.config)
    };
    this.data.nextAccountSerial += 1;
    this.data.accounts.push(account);
    this.save();
    return clonePublicAccount(account);
  }

  upsertAccount({ username, usernameKey, passwordHash, salt, role = "player", coins = null }) {
    const cleanUsername = String(username ?? "").trim().slice(0, this.config.auth.usernameMax);
    const key = usernameKey || normalizeUsernameKey(cleanUsername);
    const existing = this.getAccountByUsername(cleanUsername);
    if (existing) {
      existing.username = cleanUsername;
      existing.usernameKey = key;
      existing.passwordHash = passwordHash;
      existing.salt = salt;
      existing.role = normalizeAccountRole(role);
      if (Number.isFinite(Number(coins))) {
        existing.coins = Math.max(0, Math.floor(Number(coins)));
      }
      normalizeAccountRecord(existing, this.config);
      this.save();
      return clonePublicAccount(existing);
    }
    return this.createAccount({
      username: cleanUsername,
      usernameKey: key,
      passwordHash,
      salt,
      role
    });
  }

  getAccountById(accountId) {
    return this.data.accounts.find((account) => account.id === accountId) ?? null;
  }

  getAccountByUsername(username) {
    const key = normalizeUsernameKey(username);
    return this.data.accounts.find((account) => account.usernameKey === key) ?? null;
  }

  updateAccount(accountId, updater) {
    const account = this.getAccountById(accountId);
    if (!account) {
      return null;
    }
    updater(account);
    normalizeAccountRecord(account, this.config);
    this.save();
    return clonePublicAccount(account);
  }

  createSession({ tokenHash, accountId, createdAtMs, expiresAtMs }) {
    this.deleteSessionsForToken(tokenHash, false);
    const session = { tokenHash, accountId, createdAtMs, expiresAtMs };
    this.data.sessions.push(session);
    this.save();
    return { ...session };
  }

  getSessionByTokenHash(tokenHash) {
    this.pruneExpiredSessions();
    return this.data.sessions.find((session) => session.tokenHash === tokenHash) ?? null;
  }

  deleteSession(tokenHash) {
    return this.deleteSessionsForToken(tokenHash, true);
  }

  deleteSessionsForToken(tokenHash, shouldSave = true) {
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((session) => session.tokenHash !== tokenHash);
    const changed = this.data.sessions.length !== before;
    if (changed && shouldSave) {
      this.save();
    }
    return changed;
  }

  pruneExpiredSessions() {
    const nowMs = this.now();
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter((session) => session.expiresAtMs > nowMs);
    if (this.data.sessions.length !== before) {
      this.save();
    }
  }

  getDebugState() {
    this.pruneExpiredSessions();
    return {
      accounts: this.data.accounts.length,
      activeSessions: this.data.sessions.length,
      totalCoins: this.data.accounts.reduce((sum, account) => sum + account.coins, 0)
    };
  }
}

export function clonePublicAccount(account) {
  if (!account) {
    return null;
  }
  const cosmetics = normalizeAccountCosmetics(account);
  return {
    id: account.id,
    username: account.username,
    role: normalizeAccountRole(account.role),
    isDeveloper: normalizeAccountRole(account.role) === "developer",
    createdAtMs: account.createdAtMs,
    coins: Math.max(0, Math.floor(Number(account.coins) || 0)),
    inventory: [...cosmetics.inventory],
    equipped: { ...cosmetics.equipped },
    loadout: { ...cosmetics.loadout }
  };
}

export function normalizeUsernameKey(username) {
  return String(username ?? "").trim().toLowerCase();
}

function normalizeStoreData(data, config) {
  const normalized = {
    version: STORE_VERSION,
    nextAccountSerial: Math.max(1, Math.trunc(Number(data.nextAccountSerial) || 1)),
    accounts: Array.isArray(data.accounts) ? data.accounts : [],
    sessions: Array.isArray(data.sessions) ? data.sessions : []
  };

  for (const account of normalized.accounts) {
    normalizeAccountRecord(account, config);
  }
  normalized.sessions = normalized.sessions.filter(
    (session) => session?.tokenHash && session?.accountId && Number.isFinite(Number(session.expiresAtMs))
  );
  return normalized;
}

function normalizeAccountRecord(account, config) {
  account.username = String(account.username ?? "Tank").slice(0, config.auth.usernameMax);
  account.usernameKey = account.usernameKey || normalizeUsernameKey(account.username);
  account.role = normalizeAccountRole(account.role);
  account.createdAtMs = Math.max(0, Number(account.createdAtMs) || Date.now());
  account.coins = Math.max(0, Math.floor(Number(account.coins) || 0));
  const cosmetics = normalizeAccountCosmetics(account, config);
  account.inventory = cosmetics.inventory;
  account.equipped = cosmetics.equipped;
}

function normalizeAccountRole(role) {
  return role === "developer" ? "developer" : "player";
}
