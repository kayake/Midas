import { eq, lt } from "drizzle-orm";

import { db } from "../../db/client";
import { subscriptions, subscriptionLog } from "../../db/schema/index";

interface CreateSubscriptionInput {
  userId:     string;
  plan:       string;
  multiplier: number;
  expiresAt:  Date;
  createdBy:  string;
}

export async function setSubscription(input: CreateSubscriptionInput): Promise<void> {
  const { userId, plan, multiplier, expiresAt, createdBy } = input;

  await db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    if (existing !== undefined) {
      await tx.insert(subscriptionLog).values({
        userId:     existing.userId,
        plan:       existing.plan,
        multiplier: existing.multiplier,
        createdAt:  existing.createdAt,
        expiresAt:  existing.expiresAt,
        createdBy:  existing.createdBy,
        revokedAt:  new Date(),
        revokedBy:  createdBy
      });
      await tx.delete(subscriptions).where(eq(subscriptions.userId, userId));
    }

    await tx.insert(subscriptions).values({ userId, plan, multiplier, expiresAt, createdBy });

    await tx.insert(subscriptionLog).values({
      userId,
      plan,
      multiplier,
      createdAt: new Date(),
      expiresAt,
      createdBy
    });
  });
}

export async function revokeSubscription(userId: string, revokedBy: string): Promise<void> {
  await db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));

    if (existing === undefined) return;

    await tx.insert(subscriptionLog).values({
      userId:     existing.userId,
      plan:       existing.plan,
      multiplier: existing.multiplier,
      createdAt:  existing.createdAt,
      expiresAt:  existing.expiresAt,
      createdBy:  existing.createdBy,
      revokedAt:  new Date(),
      revokedBy
    });

    await tx.delete(subscriptions).where(eq(subscriptions.userId, userId));
  });
}

export async function getMultiplier(userId: string): Promise<number> {
  const [sub] = await db
    .select({ multiplier: subscriptions.multiplier, expiresAt: subscriptions.expiresAt })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));

  if (sub === undefined) return 1;
  if (sub.expiresAt < new Date()) return 1;
  return sub.multiplier;
}

export async function getUserPlan(userId: string): Promise<string> {
  const [sub] = await db
    .select({ plan: subscriptions.plan, expiresAt: subscriptions.expiresAt })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId));

  if (sub === undefined) return "hsbc";
  if (sub.expiresAt < new Date()) return "hsbc";
  return sub.plan;
}

export async function getSubscriptionHistory(
  userId: string
): Promise<(typeof subscriptionLog.$inferSelect)[]> {
  return db
    .select()
    .from(subscriptionLog)
    .where(eq(subscriptionLog.userId, userId))
    .orderBy(subscriptionLog.createdAt);
}

export async function cleanExpired(): Promise<void> {
  const now     = new Date();
  const expired = await db
    .select()
    .from(subscriptions)
    .where(lt(subscriptions.expiresAt, now));

  for (const sub of expired) {
    await db.transaction(async tx => {
      await tx.insert(subscriptionLog).values({
        userId:     sub.userId,
        plan:       sub.plan,
        multiplier: sub.multiplier,
        createdAt:  sub.createdAt,
        expiresAt:  sub.expiresAt,
        createdBy:  sub.createdBy,
        revokedAt:  now,
        revokedBy:  "system"
      });
      await tx.delete(subscriptions).where(eq(subscriptions.userId, sub.userId));
    });
  }
}
