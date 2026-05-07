import { APP_CONFIG } from "../../shared/config/appConfig.js";
import { GAME_CONFIG } from "../../shared/config/gameConfig.js";
import { normalizeUsernameKey } from "./accountStore.js";

export function seedDeveloperAdminAccount({ store, config = APP_CONFIG, nodeEnv = process.env.NODE_ENV } = {}) {
  const admin = config.developer?.adminAccount;
  if (!store || !admin?.enabled || nodeEnv === "production") {
    return null;
  }
  return store.upsertAccount({
    username: admin.username,
    usernameKey: normalizeUsernameKey(admin.username),
    passwordHash: admin.passwordHash,
    salt: admin.salt,
    role: admin.role
  });
}

export function isDeveloperAccount(account) {
  return account?.role === "developer" || account?.isDeveloper === true;
}

export function requireDeveloperAccount(account) {
  if (!isDeveloperAccount(account)) {
    const error = new Error("Developer account required.");
    error.status = 403;
    throw error;
  }
  return account;
}

export function sanitizeDeveloperLevelPayload(body, config = GAME_CONFIG) {
  const maxLevel = config.upgrades.maxPlayerLevel;
  const level = Math.trunc(Number(body?.level) || 1);
  return {
    level: Math.max(1, Math.min(maxLevel, level))
  };
}
