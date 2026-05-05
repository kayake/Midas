import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "../../db/client";
import { exchangeRates, serverCurrencies, guildMembers } from "../../db/schema/index";
import { effectiveRate } from "./inflation.service";

/**
 * Record a new exchange rate snapshot.
 * fromGuildId = null means central currency.
 */
export async function recordRate(
  fromGuildId: string | null,
  toGuildId:   string | null,
  rate:        number
): Promise<void> {
  await db.insert(exchangeRates).values({ fromGuildId, toGuildId, rate });
}

/**
 * Get latest rate between two currencies.
 */
export async function getRate(
  fromGuildId: string | null,
  toGuildId:   string | null
): Promise<number | null> {
  const conditions = [];

  if (fromGuildId === null) {
    conditions.push(isNull(exchangeRates.fromGuildId));
  } else {
    conditions.push(eq(exchangeRates.fromGuildId, fromGuildId));
  }

  if (toGuildId === null) {
    conditions.push(isNull(exchangeRates.toGuildId));
  } else {
    conditions.push(eq(exchangeRates.toGuildId, toGuildId));
  }

  const [row] = await db
    .select({ rate: exchangeRates.rate })
    .from(exchangeRates)
    .where(and(...conditions))
    .orderBy(desc(exchangeRates.recordedAt))
    .limit(1);

  return row?.rate ?? null;
}

/**
 * Get historical rates for graph rendering.
 */
export async function getRateHistory(
  fromGuildId: string | null,
  toGuildId:   string | null,
  limit = 30
): Promise<{ rate: number; recordedAt: Date | null }[]> {
  const conditions = [];

  if (fromGuildId === null) {
    conditions.push(isNull(exchangeRates.fromGuildId));
  } else {
    conditions.push(eq(exchangeRates.fromGuildId, fromGuildId));
  }

  if (toGuildId === null) {
    conditions.push(isNull(exchangeRates.toGuildId));
  } else {
    conditions.push(eq(exchangeRates.toGuildId, toGuildId));
  }

  return db
    .select({ rate: exchangeRates.rate, recordedAt: exchangeRates.recordedAt })
    .from(exchangeRates)
    .where(and(...conditions))
    .orderBy(desc(exchangeRates.recordedAt))
    .limit(limit);
}

/**
 * Auto-compute rate based on inflation of both currencies relative to central.
 * central = base 1.0; server currencies are valued by their inflation.
 */
export async function computeAutoRate(
  fromGuildId: string | null,
  toGuildId:   string | null
): Promise<number> {
  let fromValue = 1.0;
  let toValue   = 1.0;

  if (fromGuildId !== null) {
    const [from] = await db
      .select()
      .from(serverCurrencies)
      .where(eq(serverCurrencies.guildId, fromGuildId));
    if (from !== undefined) {
      fromValue = Math.max(0.01, 1 - effectiveRate(from));
    }
  }

  if (toGuildId !== null) {
    const [to] = await db
      .select()
      .from(serverCurrencies)
      .where(eq(serverCurrencies.guildId, toGuildId));
    if (to !== undefined) {
      toValue = Math.max(0.01, 1 - effectiveRate(to));
    }
  }

  return parseFloat((fromValue / toValue).toFixed(6));
}
