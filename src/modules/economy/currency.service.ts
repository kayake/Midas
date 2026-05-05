import { eq, sql } from "drizzle-orm";
import type { Guild } from "discord.js";

import { db } from "../../db/client";
import { serverCurrencies, guildMembers, users } from "../../db/schema/index";
import { effectiveRate } from "./inflation.service";

interface CreateCurrencyInput {
  guildId:  string;
  name:     string;
  symbol:   string;
  imageUrl: string;
}

export async function createCurrency(
  input:        CreateCurrencyInput,
  discordGuild: Guild
): Promise<{ emojiCreated: boolean; emojiId: string | null }> {
  let emojiId: string | null     = null;
  let emojiCreated               = false;
  const emojiName                = `${input.name.toLowerCase().replace(/\s+/g, "_")}_${input.guildId}`;

  try {
    const emoji = await discordGuild.emojis.create({
      attachment: input.imageUrl,
      name:       emojiName
    });
    emojiId      = emoji.id;
    emojiCreated = true;
  } catch {
    // Emoji slots full or permission denied — not fatal
    emojiCreated = false;
  }

  await db.insert(serverCurrencies).values({
    guildId:      input.guildId,
    name:         input.name,
    symbol:       input.symbol,
    imageUrl:     input.imageUrl,
    emojiId,
    emojiCreated
  });

  return { emojiCreated, emojiId };
}

export async function updateCurrencyEmoji(
  guildId:      string,
  discordGuild: Guild
): Promise<{ emojiId: string | null; created: boolean }> {
  const [currency] = await db
    .select()
    .from(serverCurrencies)
    .where(eq(serverCurrencies.guildId, guildId));

  if (currency === undefined) throw new Error("Currency not found.");

  const emojiName = `${currency.name.toLowerCase().replace(/\s+/g, "_")}_${guildId}`;

  try {
    const emoji = await discordGuild.emojis.create({
      attachment: currency.imageUrl,
      name:       emojiName
    });

    await db
      .update(serverCurrencies)
      .set({ emojiId: emoji.id, emojiCreated: true })
      .where(eq(serverCurrencies.guildId, guildId));

    return { emojiId: emoji.id, created: true };
  } catch {
    return { emojiId: null, created: false };
  }
}

export async function getCurrency(
  guildId: string
): Promise<typeof serverCurrencies.$inferSelect | null> {
  const [currency] = await db
    .select()
    .from(serverCurrencies)
    .where(eq(serverCurrencies.guildId, guildId));

  return currency ?? null;
}

export async function getCurrencyDisplay(guildId: string): Promise<string> {
  const currency = await getCurrency(guildId);
  if (currency === null) return "🪙";
  if (currency.emojiCreated && currency.emojiId !== null) {
    return `<:${currency.name.toLowerCase()}_${guildId}:${currency.emojiId}>`;
  }
  return currency.symbol;
}

export async function addServerCoins(
  userId:  string,
  guildId: string,
  amount:  number
): Promise<void> {
  await db
    .update(guildMembers)
    .set({ serverCoins: sql`${guildMembers.serverCoins} + ${amount}` })
    .where(eq(guildMembers.userId, userId));

  // Update supply
  await db
    .update(serverCurrencies)
    .set({ totalSupply: sql`${serverCurrencies.totalSupply} + ${amount}` })
    .where(eq(serverCurrencies.guildId, guildId));
}

export async function addCentralCoins(userId: string, amount: number): Promise<void> {
  await db
    .update(users)
    .set({ centralCoins: sql`${users.centralCoins} + ${amount}` })
    .where(eq(users.id, userId));
}

export async function getCentralCoins(userId: string): Promise<number> {
  const [user] = await db
    .select({ centralCoins: users.centralCoins })
    .from(users)
    .where(eq(users.id, userId));

  return user?.centralCoins ?? 0;
}

export async function centralCoinsDaily(userId: string): Promise<number> {
  const BASE = 100; // Could be dynamic based on plan, etc.
  const avgXP = await db
    .select({ avgXp: sql<number>`AVG(${guildMembers.xp})` })
    .from(guildMembers)
    .where(eq(guildMembers.userId, userId));

  const dailyAmount = Math.log10((avgXP[0].avgXp ?? 0) + 1) * BASE; // Logarithmic scaling to prevent runaway growth, ex: 0 XP = 0 coins, 10 XP = 100 coins, 100 XP = 200 coins, 1,000 XP = 300 coins, etc.
  return Math.floor(dailyAmount);
}

/**
 * Real value of server coins after applying inflation correction.
 */
export async function getRealValue(guildId: string, amount: number): Promise<number> {
  const currency = await getCurrency(guildId);
  if (currency === null) return amount;
  const rate = effectiveRate(currency);
  return parseFloat((amount * (1 - rate)).toFixed(4));
}
