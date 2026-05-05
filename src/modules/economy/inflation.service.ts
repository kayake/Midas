import { eq, sql } from "drizzle-orm";

import { db }                           from "../../db/client";
import { serverCurrencies, inflationLog, guildMembers, shopItems, users } from "../../db/schema/index";
import { INFLATION }                    from "../../shared/constants";

// ─── Rate Calculation ─────────────────────────────────────────────────────────

/**
 * Calcula a taxa de inflação automática com base no supply total em circulação.
 *
 * Lógica igual à vida real:
 *   - Pouca moeda em circulação → deflação (preços caem, moeda vale mais)
 *   - Supply médio              → taxa base neutra (~2%)
 *   - Muito supply              → alta inflação (preços sobem, moeda vale menos)
 */
export function calcAutoInflationRate(totalSupply: number): number {
  if (totalSupply <= INFLATION.LOW_SUPPLY) {
    const ratio = totalSupply / INFLATION.LOW_SUPPLY;
    return INFLATION.MIN_AUTO_RATE + (INFLATION.BASE_RATE - INFLATION.MIN_AUTO_RATE) * ratio;
  }

  if (totalSupply >= INFLATION.HIGH_SUPPLY) {
    return INFLATION.MAX_AUTO_RATE;
  }

  const ratio = (totalSupply - INFLATION.LOW_SUPPLY) / (INFLATION.HIGH_SUPPLY - INFLATION.LOW_SUPPLY);
  return INFLATION.BASE_RATE + (INFLATION.MAX_AUTO_RATE - INFLATION.BASE_RATE) * ratio;
}

// ─── Effective Rate ───────────────────────────────────────────────────────────

/**
 * Taxa efetiva de uma moeda de servidor.
 * Override manual tem prioridade sobre o automático.
 */
export function effectiveRate(currency: typeof serverCurrencies.$inferSelect): number {
  return currency.inflationOverride ?? currency.inflationRate;
}

// ─── Central Currency Inflation ───────────────────────────────────────────────

/**
 * Supply total de BankCoins = soma de todos os saldos centralCoins na tabela guildMembers.
 * Não precisa de tabela separada — usa os dados já existentes.
 */
async function getCentralSupply(): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${users.centralCoins}), 0)` })
    .from(users);

  return row?.total ?? 0;
}

/**
 * Aplica inflação na moeda central (BankCoin).
 *
 * Efeito real: quanto mais BankCoins em circulação, mais caros ficam os itens da shop.
 * - Calcula supply total de BankCoins somando todos os saldos
 * - Compara com a taxa anterior para calcular o delta
 * - Ajusta preços da shop proporcionalmente ao delta
 * - Loga no inflationLog com guildId = "central"
 *
 * NOTA DE MIGRATION: o inflationLog referencia guilds via FK.
 * Para funcionar, adicione um registro seed na tabela guilds com id = "central",
 * ou torne a coluna guildId nullable no schema.
 *
 * @param previousRate - taxa da última execução (persista no env ou DB)
 * @returns nova taxa calculada
 */
export async function runCentralInflation(previousRate: number): Promise<number> {
  const supply  = await getCentralSupply();
  const newRate = calcAutoInflationRate(supply);

  // Delta entre taxa anterior e nova — determina quanto os preços se movem
  // Ex: previousRate=0.02, newRate=0.05 → priceFactor=1.03 → preços sobem 3%
  const priceFactor = 1 + (newRate - previousRate);

  await db.transaction(async tx => {
    // Corrige todos os preços da shop pelo delta de inflação
    // GREATEST(1, ...) garante que nenhum item fique com preço < 1
    await tx
      .update(shopItems)
      .set({
        price: sql`CAST(GREATEST(1, ROUND(${shopItems.price}::numeric * ${priceFactor}::numeric, 2)) AS real)`
      });

    await tx.insert(inflationLog).values({
      guildId:    "central",
      rateBefore: previousRate,
      rateAfter:  newRate,
      supply,
      reason:     "auto",
      changedBy:  null
    });
  });

  console.log(
    `[Inflation] Central — supply: ${supply.toLocaleString()} | ` +
    `${(previousRate * 100).toFixed(2)}% → ${(newRate * 100).toFixed(2)}% | ` +
    `price factor: ×${priceFactor.toFixed(4)}`
  );

  return newRate;
}

// ─── Server Currency Inflation ────────────────────────────────────────────────

/**
 * Recalcula e aplica inflação automática para todas as moedas de servidor.
 * A inflação de moedas de servidor não afeta preços da shop (são preços em BankCoin).
 * Ela afeta o valor de câmbio da moeda em relação à central.
 */
export async function runServerInflation(): Promise<void> {
  const currencies = await db.select().from(serverCurrencies);

  for (const currency of currencies) {
    const newRate = calcAutoInflationRate(currency.totalSupply);

    await db.transaction(async tx => {
      await tx.insert(inflationLog).values({
        guildId:    currency.guildId,
        rateBefore: currency.inflationRate,
        rateAfter:  newRate,
        supply:     currency.totalSupply,
        reason:     "auto",
        changedBy:  null
      });

      await tx
        .update(serverCurrencies)
        .set({ inflationRate: newRate, lastInflationAt: new Date() })
        .where(eq(serverCurrencies.guildId, currency.guildId));
    });

    console.log(
      `[Inflation] Guild ${currency.guildId} — ` +
      `${(currency.inflationRate * 100).toFixed(2)}% → ${(newRate * 100).toFixed(2)}%`
    );
  }
}

/**
 * Ponto de entrada único chamado pelo job diário.
 * Roda inflação central + todas as moedas de servidor.
 *
 * @param centralPreviousRate - persistir entre execuções (no .env ou numa tabela de config)
 */
export async function runAutoInflation(): Promise<void> {
  const centralPreviousRate = await db
    .select({ rate: sql<number>`COALESCE((SELECT rate_after FROM ${inflationLog} WHERE guild_id = 'central' ORDER BY created_at DESC LIMIT 1), 0)` })
    .from(inflationLog)
    .where(eq(inflationLog.guildId, "central"))
    .then(rows => rows[0]?.rate ?? 0);
  await runCentralInflation(centralPreviousRate);
  await runServerInflation();
}

// ─── Manual Override (moedas de servidor) ────────────────────────────────────

/**
 * Permite ao dono do servidor sobrescrever a taxa manualmente.
 * O bot continua calculando a automática em background,
 * mas effectiveRate() retornará o override até ser removido.
 */
export async function setManualOverride(
  guildId:   string,
  rate:      number,
  changedBy: string
): Promise<void> {
  const [currency] = await db
    .select()
    .from(serverCurrencies)
    .where(eq(serverCurrencies.guildId, guildId));

  if (currency === undefined) throw new Error("Moeda não encontrada para este servidor.");

  await db.transaction(async tx => {
    await tx.insert(inflationLog).values({
      guildId,
      rateBefore: effectiveRate(currency),
      rateAfter:  rate,
      supply:     currency.totalSupply,
      reason:     "manual",
      changedBy
    });

    await tx
      .update(serverCurrencies)
      .set({ inflationOverride: rate })
      .where(eq(serverCurrencies.guildId, guildId));
  });
}

/**
 * Remove o override manual — bot volta ao controle automático.
 */
export async function clearManualOverride(guildId: string, changedBy: string): Promise<void> {
  const [currency] = await db
    .select()
    .from(serverCurrencies)
    .where(eq(serverCurrencies.guildId, guildId));

  if (currency === undefined) throw new Error("Moeda não encontrada para este servidor.");

  await db.transaction(async tx => {
    await tx.insert(inflationLog).values({
      guildId,
      rateBefore: effectiveRate(currency),
      rateAfter:  currency.inflationRate,
      supply:     currency.totalSupply,
      reason:     "manual",
      changedBy
    });

    await tx
      .update(serverCurrencies)
      .set({ inflationOverride: null })
      .where(eq(serverCurrencies.guildId, guildId));
  });
}

// ─── Utils ────────────────────────────────────────────────────────────────────

/**
 * Valor real de um amount após desvalorização pela inflação.
 * Ex: 100 moedas com 5% inflação = vale 95 em poder de compra.
 */
export function applyInflation(amount: number, rate: number): number {
  return parseFloat((amount * (1 - rate)).toFixed(4));
}

/**
 * Info de inflação de uma guild para exibição (serverinfo, currency-edit).
 */
export async function getInflationInfo(guildId: string): Promise<{
  autoRate:      number;
  effectiveRate: number;
  isOverridden:  boolean;
  totalSupply:   number;
} | null> {
  const [currency] = await db
    .select()
    .from(serverCurrencies)
    .where(eq(serverCurrencies.guildId, guildId));

  if (currency === undefined) return null;

  return {
    autoRate:      currency.inflationRate,
    effectiveRate: effectiveRate(currency),
    isOverridden:  currency.inflationOverride !== null,
    totalSupply:   currency.totalSupply
  };
}