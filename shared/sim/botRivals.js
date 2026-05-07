import { BOT_PROFILE_CONFIG } from "../config/botProfileConfig.js";

export const BOT_RIVAL_TIERS = Object.freeze({
  NONE: "none",
  RIVAL: "rival",
  THREAT: "threat",
  BOUNTY: "bounty"
});

const TIER_WEIGHT = Object.freeze({
  [BOT_RIVAL_TIERS.NONE]: 0,
  [BOT_RIVAL_TIERS.RIVAL]: 1,
  [BOT_RIVAL_TIERS.THREAT]: 2,
  [BOT_RIVAL_TIERS.BOUNTY]: 3
});

export function createBotRivalState(nowMs = 0) {
  return {
    tier: BOT_RIVAL_TIERS.NONE,
    killStreak: 0,
    bountyClaimed: false,
    lastKillAtMs: -Infinity,
    lastTierChangeAtMs: nowMs,
    revengeTargetId: null,
    revengeUntilMs: 0
  };
}

export function ensureBotRivalState(bot, nowMs = 0) {
  if (!bot || bot.kind !== "bot") {
    return null;
  }
  bot.ai ??= {};
  bot.ai.rival ??= createBotRivalState(nowMs);
  bot.ai.rival.tier ??= BOT_RIVAL_TIERS.NONE;
  bot.ai.rival.killStreak ??= 0;
  bot.ai.rival.bountyClaimed ??= false;
  bot.ai.rival.lastKillAtMs ??= -Infinity;
  bot.ai.rival.lastTierChangeAtMs ??= nowMs;
  bot.ai.rival.revengeTargetId ??= null;
  bot.ai.rival.revengeUntilMs ??= 0;
  return bot.ai.rival;
}

export function clearBotRivalState(bot, nowMs = 0) {
  if (!bot || bot.kind !== "bot") {
    return null;
  }
  bot.ai ??= {};
  bot.ai.rival = createBotRivalState(nowMs);
  return bot.ai.rival;
}

export function recordBotRivalDamageMemory(bot, attackerId, nowMs = 0, config = BOT_PROFILE_CONFIG.rivals) {
  const state = ensureBotRivalState(bot, nowMs);
  if (!state || !attackerId || attackerId === bot.id || !config?.enabled) {
    return state;
  }
  state.revengeTargetId = attackerId;
  state.revengeUntilMs = nowMs + Math.max(0, Number(config.revenge?.memoryMs) || 0);
  updateBotRivalTier(bot, nowMs, config);
  return state;
}

export function recordBotRivalKill(bot, victim, nowMs = 0, config = BOT_PROFILE_CONFIG.rivals) {
  const state = ensureBotRivalState(bot, nowMs);
  if (!state || !victim || victim.id === bot.id || !config?.enabled) {
    return state;
  }
  state.killStreak += 1;
  state.lastKillAtMs = nowMs;
  if (victim.kind === "player") {
    state.revengeTargetId = victim.id;
    state.revengeUntilMs = nowMs + Math.max(0, Number(config.revenge?.memoryMs) || 0);
  }
  updateBotRivalTier(bot, nowMs, config);
  return state;
}

export function updateBotRivalTier(bot, nowMs = 0, config = BOT_PROFILE_CONFIG.rivals) {
  const state = ensureBotRivalState(bot, nowMs);
  if (!state) {
    return BOT_RIVAL_TIERS.NONE;
  }
  if (state.revengeUntilMs <= nowMs) {
    state.revengeTargetId = null;
  }
  const nextTier = getBotRivalTier(bot, config);
  if (nextTier !== state.tier) {
    state.tier = nextTier;
    state.lastTierChangeAtMs = nowMs;
    if (nextTier !== BOT_RIVAL_TIERS.BOUNTY) {
      state.bountyClaimed = false;
    }
  }
  return state.tier;
}

export function getBotRivalTier(bot, config = BOT_PROFILE_CONFIG.rivals) {
  if (!config?.enabled || !bot || bot.kind !== "bot") {
    return BOT_RIVAL_TIERS.NONE;
  }
  const level = Math.max(1, Math.trunc(Number(bot.level) || 1));
  if (level < config.minLevel) {
    return BOT_RIVAL_TIERS.NONE;
  }

  const state = ensureBotRivalState(bot);
  const killStreak = Math.max(0, Math.trunc(Number(state?.killStreak) || 0));
  const score = Math.max(0, Math.floor(Number(bot.score) || 0));

  if (killStreak >= config.bountyKillStreak || score >= config.bountyScoreThreshold) {
    return BOT_RIVAL_TIERS.BOUNTY;
  }
  if (score >= config.threatScoreThreshold) {
    return BOT_RIVAL_TIERS.THREAT;
  }
  if (killStreak >= config.rivalKillStreak || state.revengeTargetId) {
    return BOT_RIVAL_TIERS.RIVAL;
  }
  return BOT_RIVAL_TIERS.NONE;
}

export function getBotBountyReward(bot, config = BOT_PROFILE_CONFIG.rivals) {
  const tier = getBotRivalTier(bot, config);
  if (tier !== BOT_RIVAL_TIERS.BOUNTY || ensureBotRivalState(bot)?.bountyClaimed) {
    return { coins: 0, xp: 0, score: 0 };
  }
  const bounty = config.bounty;
  const level = Math.max(config.minLevel, Math.trunc(Number(bot.level) || config.minLevel));
  const killStreak = Math.max(0, Math.trunc(Number(bot.ai?.rival?.killStreak) || 0));
  const score = Math.max(0, Math.floor(Number(bot.score) || 0));
  const pressure = Math.min(1, Math.max(
    killStreak / Math.max(1, config.bountyKillStreak + 2),
    score / Math.max(1, config.bountyScoreThreshold * 1.6),
    level / 60
  ));

  return {
    coins: roundClamp(bounty.minCoins + pressure * (bounty.maxCoins - bounty.minCoins), bounty.minCoins, bounty.maxCoins),
    xp: roundClamp(bounty.minXp + pressure * (bounty.maxXp - bounty.minXp), bounty.minXp, bounty.maxXp),
    score: roundClamp(bounty.minScore + pressure * (bounty.maxScore - bounty.minScore), bounty.minScore, bounty.maxScore)
  };
}

export function canClaimBotBounty({ bot, killer, recentClaims = [], nowMs = 0, config = BOT_PROFILE_CONFIG.rivals } = {}) {
  if (!config?.enabled || !bot || !killer || killer.kind !== "player") {
    return { allowed: false, reason: "not-player" };
  }
  const state = ensureBotRivalState(bot, nowMs);
  if (getBotRivalTier(bot, config) !== BOT_RIVAL_TIERS.BOUNTY) {
    return { allowed: false, reason: "not-bounty" };
  }
  if (state.bountyClaimed) {
    return { allowed: false, reason: "already-claimed" };
  }

  const windowMs = Math.max(0, Number(config.bounty?.claimWindowMs) || 0);
  const maxClaims = Math.max(0, Math.trunc(Number(config.bounty?.maxClaimsPerWindow) || 0));
  const activeClaims = recentClaims.filter((claim) => (
    claim?.killerId === killer.id &&
    nowMs - (Number(claim.atMs) || 0) <= windowMs
  ));
  if (maxClaims > 0 && activeClaims.length >= maxClaims) {
    return { allowed: false, reason: "anti-farm" };
  }
  return { allowed: true, reason: "ok" };
}

export function pruneBotBountyClaims(recentClaims = [], nowMs = 0, config = BOT_PROFILE_CONFIG.rivals) {
  const windowMs = Math.max(0, Number(config?.bounty?.claimWindowMs) || 0);
  return recentClaims.filter((claim) => nowMs - (Number(claim?.atMs) || 0) <= windowMs);
}

export function markBotBountyClaimed(bot, nowMs = 0) {
  const state = ensureBotRivalState(bot, nowMs);
  if (!state) {
    return null;
  }
  state.bountyClaimed = true;
  state.tier = BOT_RIVAL_TIERS.NONE;
  return state;
}

export function getBotRivalSnapshot(bot, nowMs = 0, config = BOT_PROFILE_CONFIG.rivals) {
  const tier = updateBotRivalTier(bot, nowMs, config);
  if (tier === BOT_RIVAL_TIERS.NONE) {
    return null;
  }
  const reward = tier === BOT_RIVAL_TIERS.BOUNTY
    ? getBotBountyReward(bot, config)
    : { coins: 0, xp: 0, score: 0 };
  const hpRatio = Math.max(0, Math.min(1, (Number(bot.hp) || 0) / Math.max(1, Number(bot.maxHp) || 1)));
  return {
    id: bot.id,
    name: String(bot.name ?? "Bot").slice(0, 32),
    tier,
    label: getBotRivalLabel(tier),
    x: Math.round((Number(bot.x) || 0) * 10) / 10,
    y: Math.round((Number(bot.y) || 0) * 10) / 10,
    hpRatio: Math.round(hpRatio * 1000) / 1000,
    level: Math.max(1, Math.trunc(Number(bot.level) || 1)),
    score: Math.floor(Number(bot.score) || 0),
    killStreak: Math.max(0, Math.trunc(Number(bot.ai?.rival?.killStreak) || 0)),
    bountyCoins: reward.coins,
    bountyXp: reward.xp,
    bountyScore: reward.score,
    targetId: bot.ai?.targetKind === "tank" ? bot.ai?.targetId ?? null : null,
    revengeTargetId: (bot.ai?.rival?.revengeUntilMs ?? 0) > nowMs ? bot.ai?.rival?.revengeTargetId ?? null : null
  };
}

export function getBotRivalSnapshots(tanks, nowMs = 0, config = BOT_PROFILE_CONFIG.rivals) {
  const limit = Math.max(0, Math.trunc(Number(config?.snapshotLimit) || 0));
  if (limit <= 0) {
    return [];
  }
  return [...tanks]
    .filter((tank) => tank?.kind === "bot" && tank.state === "alive")
    .map((tank) => getBotRivalSnapshot(tank, nowMs, config))
    .filter(Boolean)
    .sort((a, b) => TIER_WEIGHT[b.tier] - TIER_WEIGHT[a.tier] || b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function getBotRivalDebug(tanks, nowMs = 0, recentClaims = [], config = BOT_PROFILE_CONFIG.rivals) {
  const counts = {
    [BOT_RIVAL_TIERS.RIVAL]: 0,
    [BOT_RIVAL_TIERS.THREAT]: 0,
    [BOT_RIVAL_TIERS.BOUNTY]: 0
  };
  for (const tank of tanks) {
    if (tank?.kind !== "bot" || tank.state !== "alive") {
      continue;
    }
    const tier = updateBotRivalTier(tank, nowMs, config);
    if (tier !== BOT_RIVAL_TIERS.NONE) {
      counts[tier] = (counts[tier] ?? 0) + 1;
    }
  }
  const windowMs = Math.max(0, Number(config?.bounty?.claimWindowMs) || 0);
  const activeClaims = recentClaims.filter((claim) => nowMs - (Number(claim.atMs) || 0) <= windowMs);
  return {
    counts,
    active: counts.rival + counts.threat + counts.bounty,
    recentClaims: activeClaims.length,
    enabled: Boolean(config?.enabled)
  };
}

export function getBotRivalLabel(tier) {
  if (tier === BOT_RIVAL_TIERS.BOUNTY) {
    return "Bounty";
  }
  if (tier === BOT_RIVAL_TIERS.THREAT) {
    return "Threat";
  }
  if (tier === BOT_RIVAL_TIERS.RIVAL) {
    return "Rival";
  }
  return "";
}

export function getBotRivalTargetScoreBonus(bot, enemy, nowMs = 0, config = BOT_PROFILE_CONFIG.rivals) {
  if (!config?.enabled || !bot || !enemy || bot.kind !== "bot") {
    return 0;
  }
  const state = ensureBotRivalState(bot, nowMs);
  return state?.revengeTargetId === enemy.id && state.revengeUntilMs > nowMs
    ? Math.max(0, Number(config.revenge?.targetScoreBonus) || 0)
    : 0;
}

function roundClamp(value, min, max) {
  return Math.max(Math.floor(min), Math.min(Math.floor(max), Math.round(value)));
}
