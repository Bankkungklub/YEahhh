const appConfig = {
  auth: {
    usernameMin: 3,
    usernameMax: 16,
    passwordMin: 8,
    sessionCookieName: "ta_session",
    sessionTtlMs: 1000 * 60 * 60 * 24 * 14,
    loginRateLimitWindowMs: 60000,
    loginRateLimitMax: 8,
    passwordHash: {
      algorithm: "scrypt",
      keyLength: 64,
      saltBytes: 16
    }
  },
  api: {
    maxJsonBytes: 8192
  },
  storage: {
    path: "server/data/accounts.json",
    backupCorruptFiles: true
  },
  economy: {
    matchCoinSoftCap: 400,
    postCapMultiplier: 0.25,
    shapeCoinDivisor: 8,
    botKillBaseCoins: 8,
    botKillPerLevelCoins: 1.5,
    playerKillBaseCoins: 12,
    playerKillPerLevelCoins: 2,
    winBonusCoins: 0
  },
  shop: {
    defaultCoins: 120,
    defaultItems: ["body-blue", "outline-dark", "badge-none"],
    maxEquippedBySlot: 1
  },
  matchmaking: {
    defaultRegion: "local-public",
    regions: [
      {
        id: "local-public",
        label: "Localhost",
        status: "online"
      }
    ],
    roomTickRate: 30,
    roomSnapshotRate: 15,
    maxRooms: 32,
    maxPlayersPerRoom: 32,
    inactiveRoomTtlMs: 300000,
    publicRoomTargetPlayers: 12,
    customRoomNameMax: 24
  },
  developer: {
    adminAccount: {
      enabled: true,
      username: "Admin",
      role: "developer",
      salt: "dd8978bfbb7747e22822714a0677ab33",
      passwordHash: "331873d312b1f9d8e6e1066e747a4540add0165d11c452e276e73e9bfaa181c0d6201b20339ff0b79674ed6b8af1bb788c1415000cd98ccb68edbf4325e77c63"
    }
  }
};

export const APP_CONFIG = deepFreeze(appConfig);

export function validateAppConfig(config = APP_CONFIG) {
  const issues = [];
  if (config.auth.usernameMin < 1 || config.auth.usernameMax < config.auth.usernameMin) {
    issues.push("auth username limits are invalid.");
  }
  if (config.auth.passwordMin < 8) {
    issues.push("auth.passwordMin must be at least 8.");
  }
  if (config.auth.sessionTtlMs <= 0) {
    issues.push("auth.sessionTtlMs must be positive.");
  }
  if (config.api.maxJsonBytes < 1024) {
    issues.push("api.maxJsonBytes is too small.");
  }
  if (config.economy.matchCoinSoftCap < 1) {
    issues.push("economy.matchCoinSoftCap must be positive.");
  }
  if (config.economy.postCapMultiplier < 0 || config.economy.postCapMultiplier > 1) {
    issues.push("economy.postCapMultiplier must be between 0 and 1.");
  }
  if (config.shop.defaultCoins < 0) {
    issues.push("shop.defaultCoins cannot be negative.");
  }
  if (config.matchmaking.maxRooms < 1 || config.matchmaking.maxPlayersPerRoom < 1) {
    issues.push("matchmaking capacity must be positive.");
  }
  if (config.matchmaking.inactiveRoomTtlMs <= 0) {
    issues.push("matchmaking.inactiveRoomTtlMs must be positive.");
  }
  const admin = config.developer?.adminAccount;
  if (admin?.enabled) {
    if (!admin.username || admin.username.length > config.auth.usernameMax) {
      issues.push("developer.adminAccount.username is invalid.");
    }
    if (admin.role !== "developer") {
      issues.push("developer.adminAccount.role must be developer.");
    }
    if (!/^[a-f0-9]{32}$/i.test(admin.salt ?? "")) {
      issues.push("developer.adminAccount.salt must be a 16-byte hex string.");
    }
    if (!/^[a-f0-9]{128}$/i.test(admin.passwordHash ?? "")) {
      issues.push("developer.adminAccount.passwordHash must be a scrypt hex hash.");
    }
  }
  return issues;
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
