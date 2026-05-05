import "dotenv/config";

import { Redis } from "ioredis";

const redis = new Redis({
  host:                 process.env.REDIS_HOST ?? "localhost",
  port:                 Number(process.env.REDIS_PORT ?? 6379),
  password:             process.env.REDIS_PASSWORD ?? undefined,
  maxRetriesPerRequest: 3,
  enableReadyCheck:     true,
  lazyConnect:          true
});

redis.on("error", (err: Error) => {
  console.error("[Redis] Connection error:", err.message);
});

redis.on("connect", () => {
  console.log("[Redis] Connected");
});

// ─── XP Cooldown ──────────────────────────────────────────────────────────────
const XP_COOLDOWN_SECONDS = 60;

export async function hasXPCooldown(userId: string): Promise<boolean> {
  const exists = await redis.exists(`cooldown:xp:${userId}`);
  return exists === 1;
}

export async function setXPCooldown(userId: string): Promise<void> {
  await redis.set(`cooldown:xp:${userId}`, "1", "EX", XP_COOLDOWN_SECONDS);
}

// ─── Daily Claim ──────────────────────────────────────────────────────────────
export async function hasDailyClaimed(userId: string): Promise<boolean> {
  const exists = await redis.exists(`daily:claimed:${userId}`);
  return exists === 1;
}

export async function setDailyClaimed(userId: string): Promise<void> {
  await redis.set(`daily:claimed:${userId}`, "1", "EX", secondsUntilMidnight());
}

// ─── Profile Cache ────────────────────────────────────────────────────────────
const PROFILE_TTL = 300;

export async function getCachedProfile(userId: string): Promise<string | null> {
  return redis.get(`profile:${userId}`);
}

export async function setCachedProfile(userId: string, data: string): Promise<void> {
  await redis.set(`profile:${userId}`, data, "EX", PROFILE_TTL);
}

export async function invalidateProfileCache(userId: string): Promise<void> {
  await redis.del(`profile:${userId}`);
}

// ─── Generic Rate Limit ───────────────────────────────────────────────────────
export async function isRateLimited(
  userId:        string,
  action:        string,
  limitSeconds:  number
): Promise<boolean> {
  const key    = `ratelimit:${action}:${userId}`;
  const exists = await redis.exists(key);
  if (exists === 1) return true;
  await redis.set(key, "1", "EX", limitSeconds);
  return false;
}

// ─── Mission Reset Tracking ───────────────────────────────────────────────────
export async function getMissionResets(userId: string): Promise<number> {
  const val = await redis.get(`mission:resets:${userId}`);
  return val !== null ? parseInt(val) : 0;
}

export async function incrementMissionResets(userId: string): Promise<void> {
  const key = `mission:resets:${userId}`;
  await redis.incr(key);
  await redis.expireat(key, midnightTimestamp());
}

// ─── Mission Extra Slots (bought packs) ──────────────────────────────────────
// Each pack purchase adds +3 slots, stored as total extra slots bought today
export async function getMissionExtraSlots(userId: string): Promise<number> {
  const val = await redis.get(`mission:extraslots:${userId}`);
  return val !== null ? parseInt(val) : 0;
}

export async function addMissionExtraSlots(userId: string, amount: number): Promise<void> {
  const key = `mission:extraslots:${userId}`;
  await redis.incrby(key, amount);
  await redis.expireat(key, midnightTimestamp());
}

// ─── Mission Shown Slots (how many missions are currently "visible") ──────────
// Starts at base (3 + planBonus), grows when user buys extra packs
export async function getMissionShownSlots(userId: string, baseSlots: number): Promise<number> {
  const extra = await getMissionExtraSlots(userId);
  return baseSlots + extra;
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function secondsUntilMidnight(): number {
  const now      = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

function midnightTimestamp(): number {
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  return Math.floor(midnight.getTime() / 1000);
}

export default redis;

// ─── Ad Cooldown per user ─────────────────────────────────────────────────────
export async function hasAdCooldown(userId: string): Promise<boolean> {
  const exists = await redis.exists(`ad:cooldown:${userId}`);
  return exists === 1;
}

export async function setAdCooldown(userId: string, seconds: number): Promise<void> {
  await redis.set(`ad:cooldown:${userId}`, "1", "EX", seconds);
}

// ─── Leaderboard Sorted Sets ──────────────────────────────────────────────────
// Uses Redis ZADD/ZREVRANGE for O(log N) ranked lookups
// Keys:
//   lb:global          → score = centralCoins, member = userId
//   lb:server:{guildId}→ score = serverCoins,  member = userId
//   lb:xp:{guildId}    → score = xp,           member = userId

export async function lbSetGlobal(userId: string, coins: number): Promise<void> {
  await redis.zadd("lb:global", coins, userId);
}

export async function lbSetServer(guildId: string, userId: string, coins: number): Promise<void> {
  await redis.zadd(`lb:server:${guildId}`, coins, userId);
  // expire after 25 hours (refreshed on daily/mission)
  await redis.expire(`lb:server:${guildId}`, 90_000);
}

export async function lbSetXP(guildId: string, userId: string, xp: number): Promise<void> {
  await redis.zadd(`lb:xp:${guildId}`, xp, userId);
  await redis.expire(`lb:xp:${guildId}`, 90_000);
}

// Returns [ { userId, score } ] highest first, page-based
export async function lbGetGlobal(
  page: number, perPage: number
): Promise<{ userId: string; score: number }[]> {
  const offset = (page - 1) * perPage;
  const raw    = await redis.zrevrange("lb:global", offset, offset + perPage - 1, "WITHSCORES");
  return parsePairs(raw);
}

export async function lbGetServer(
  guildId: string, page: number, perPage: number
): Promise<{ userId: string; score: number }[]> {
  const offset = (page - 1) * perPage;
  const raw    = await redis.zrevrange(`lb:server:${guildId}`, offset, offset + perPage - 1, "WITHSCORES");
  return parsePairs(raw);
}

export async function lbGetXP(
  guildId: string, page: number, perPage: number
): Promise<{ userId: string; score: number }[]> {
  const offset = (page - 1) * perPage;
  const raw    = await redis.zrevrange(`lb:xp:${guildId}`, offset, offset + perPage - 1, "WITHSCORES");
  return parsePairs(raw);
}

export async function lbCountGlobal(): Promise<number> {
  return redis.zcard("lb:global");
}

export async function lbCountServer(guildId: string): Promise<number> {
  return redis.zcard(`lb:server:${guildId}`);
}

export async function lbCountXP(guildId: string): Promise<number> {
  return redis.zcard(`lb:xp:${guildId}`);
}

export async function lbRankGlobal(userId: string): Promise<number | null> {
  const rank = await redis.zrevrank("lb:global", userId);
  return rank !== null ? rank + 1 : null;
}

export async function lbRankServer(guildId: string, userId: string): Promise<number | null> {
  const rank = await redis.zrevrank(`lb:server:${guildId}`, userId);
  return rank !== null ? rank + 1 : null;
}

export async function lbRankXP(guildId: string, userId: string): Promise<number | null> {
  const rank = await redis.zrevrank(`lb:xp:${guildId}`, userId);
  return rank !== null ? rank + 1 : null;
}

// ─── Bot stats cached counters ────────────────────────────────────────────────
export async function statsIncrUsers(): Promise<void> {
  await redis.incr("stats:total_users");
}

export async function statsGetUsers(): Promise<number> {
  const v = await redis.get("stats:total_users");
  return v !== null ? parseInt(v) : 0;
}

export async function statsSetGuilds(count: number): Promise<void> {
  await redis.set("stats:total_guilds", count, "EX", 300);
}

export async function statsGetGuilds(): Promise<number> {
  const v = await redis.get("stats:total_guilds");
  return v !== null ? parseInt(v) : 0;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parsePairs(raw: string[]): { userId: string; score: number }[] {
  const result: { userId: string; score: number }[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    result.push({ userId: raw[i]!, score: parseFloat(raw[i + 1]!) });
  }
  return result;
}