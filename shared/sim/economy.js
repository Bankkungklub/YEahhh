import { APP_CONFIG } from "../config/appConfig.js";

export function coinsForShape(shapeXp, config = APP_CONFIG) {
  const xp = Math.max(0, Number(shapeXp) || 0);
  return Math.floor(xp / config.economy.shapeCoinDivisor);
}

export function coinsForTankKill(victim, config = APP_CONFIG) {
  const level = Math.max(1, Math.trunc(Number(victim?.level) || 1));
  if (victim?.kind === "bot") {
    return config.economy.botKillBaseCoins + Math.floor(level * config.economy.botKillPerLevelCoins);
  }
  return config.economy.playerKillBaseCoins + level * config.economy.playerKillPerLevelCoins;
}

export function applyMatchCoinCap(currentMatchCoins, rawCoins, config = APP_CONFIG) {
  const current = Math.max(0, Math.floor(Number(currentMatchCoins) || 0));
  const raw = Math.max(0, Math.floor(Number(rawCoins) || 0));
  if (raw <= 0) {
    return 0;
  }

  const cap = config.economy.matchCoinSoftCap;
  if (current >= cap) {
    return Math.floor(raw * config.economy.postCapMultiplier);
  }

  const beforeCap = Math.min(raw, cap - current);
  const afterCap = raw - beforeCap;
  return beforeCap + Math.floor(afterCap * config.economy.postCapMultiplier);
}
