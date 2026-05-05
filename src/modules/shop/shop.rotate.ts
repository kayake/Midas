import { eq, lt } from "drizzle-orm";
import cron from "node-cron";

import { db } from "../../db/client";
import { dailyShop, shopItems } from "../../db/schema/index";
import { SHOP } from "../../shared/constants";
import { runAutoInflation } from "../economy/inflation.service";

type Rarity = keyof typeof SHOP.RARITY_WEIGHTS;

async function getWeightedRandomItems(
  amount: number
): Promise<(typeof shopItems.$inferSelect)[]> {
  const all = await db
    .select()
    .from(shopItems)
    .where(eq(shopItems.rotative, true));

  const pool: (typeof shopItems.$inferSelect)[] = [];
  for (const item of all) {
    const weight = SHOP.RARITY_WEIGHTS[item.rarity as Rarity] ?? 10;
    for (let i = 0; i < weight; i++) pool.push(item);
  }

  pool.sort(() => Math.random() - 0.5);

  const seen     = new Set<number>();
  const selected: (typeof shopItems.$inferSelect)[] = [];

  for (const item of pool) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    selected.push(item);
    if (selected.length >= amount) break;
  }

  return selected;
}

export async function rotateShop(extraSlots = 0): Promise<void> {
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + SHOP.DURATION_HOURS * 60 * 60 * 1000);
  const slots     = SHOP.SLOTS_BASE + extraSlots;

  await db.transaction(async tx => {
    await tx.delete(dailyShop).where(lt(dailyShop.expiresAt, now));
    const items = await getWeightedRandomItems(slots);
    if (items.length === 0) return;
    await tx.insert(dailyShop).values(items.map(item => ({ itemId: item.id, expiresAt })));
  });

  console.log(`[Shop] Rotated at ${now.toISOString()} — ${slots} slots`);
}

// Runs every day at 22:00
cron.schedule(`0 ${SHOP.ROTATE_HOUR} * * *`, () => {
  void runAutoInflation().catch(err => console.error("Error running auto inflation during shop rotation:", err));
  void rotateShop();
});

export default rotateShop;
