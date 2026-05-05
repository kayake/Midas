// src/modules/shop/shop.service.ts
import { and, eq, gt, inArray } from "drizzle-orm";

import { db } from "../../db/client";
import { dailyShop, shopItems, inventories, guildMembers, users } from "../../db/schema/index";

export async function getDailyShop(): Promise<(typeof shopItems.$inferSelect)[]> {
  const now    = new Date();
  const active = await db
    .select({ itemId: dailyShop.itemId })
    .from(dailyShop)
    .where(gt(dailyShop.expiresAt, now));

  if (active.length === 0) return [];

  const ids = active.map(r => r.itemId);
  return db.select().from(shopItems).where(inArray(shopItems.id, ids));
}

export async function buyItem(
  userId:  string,
  itemId:  number
): Promise<{ success: boolean; reason?: string }> {
  return db.transaction(async tx => {
    const now = new Date();

    const [inShop] = await tx
      .select()
      .from(dailyShop)
      .where(and(eq(dailyShop.itemId, itemId), gt(dailyShop.expiresAt, now)));

    if (inShop === undefined) return { success: false, reason: "shop.not_available" };

    const [item] = await tx
      .select()
      .from(shopItems)
      .where(eq(shopItems.id, itemId));

    if (item === undefined || !item.buyable) return { success: false, reason: "shop.not_buyable" };

    const [owned] = await tx
      .select()
      .from(inventories)
      .where(and(eq(inventories.userId, userId), eq(inventories.itemId, itemId)));

    if (owned !== undefined) return { success: false, reason: "shop.owned" };

    const [user] = await tx
      .select({ centralCoins: users.centralCoins })
      .from(users)
      .where(eq(users.id, userId));

    if (user === undefined) return { success: false, reason: "error.generic" };
    if (user.centralCoins < item.price) return { success: false, reason: "shop.no_coins" };

    await tx
      .update(users)
      .set({ centralCoins: user.centralCoins - item.price })
      .where(eq(users.id, userId));

    await tx.insert(inventories).values({ userId, itemId, source: "shop" });

    return { success: true };
  });
}
