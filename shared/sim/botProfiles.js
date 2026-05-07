import { BOT_PROFILE_CONFIG } from "../config/botProfileConfig.js";

const PROFILE_BY_ID = new Map(BOT_PROFILE_CONFIG.profiles.map((profile) => [profile.id, profile]));

export function getBotProfile(profileId, config = BOT_PROFILE_CONFIG) {
  const map = config === BOT_PROFILE_CONFIG
    ? PROFILE_BY_ID
    : new Map(config.profiles.map((profile) => [profile.id, profile]));
  return map.get(profileId) ?? map.get(config.defaultProfileId) ?? config.profiles[0];
}

export function chooseBotProfile(rng = Math.random, config = BOT_PROFILE_CONFIG) {
  const roll = Math.max(0, Math.min(0.999999, Number(rng()) || 0));
  let cursor = 0;
  for (const profile of config.profiles) {
    cursor += profile.weight;
    if (roll < cursor) {
      return profile.id;
    }
  }
  return config.profiles[config.profiles.length - 1].id;
}

export function applyProfileToBot(bot, profileId, config = BOT_PROFILE_CONFIG) {
  const profile = getBotProfile(profileId, config);
  if (!bot.ai) {
    bot.ai = {};
  }
  bot.ai.profileId = profile.id;
  bot.ai.profileLabel = profile.label;
  bot.ai.aimErrorRadians ??= 0;
  bot.ai.targetStickUntilMs ??= 0;
  return profile;
}

export function getBotProfileDebugCounts(tanks, config = BOT_PROFILE_CONFIG) {
  const counts = Object.fromEntries(config.profiles.map((profile) => [profile.id, 0]));
  for (const tank of tanks) {
    if (tank.kind !== "bot") {
      continue;
    }
    const profile = getBotProfile(tank.ai?.profileId, config);
    counts[profile.id] = (counts[profile.id] ?? 0) + 1;
  }
  return counts;
}
