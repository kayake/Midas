import { eq, sql } from "drizzle-orm";

import { db } from "../../db/client";
import { hasXPCooldown, setXPCooldown } from "../../db/redis";
import { guildMembers, guilds, levelRewards, users, xpLog } from "../../db/schema/index";
import { applyMultiplier, calcLevel, XP_PER_ACTION } from "./xp.config";
import { getMultiplier } from "../subscription/subscription.service";

import type { XPAlgorithm, XPSource } from "./xp.config";

export interface AddXPResult {
  xp:        number;
  level:     number;
  leveledUp: boolean;
  newLevel:  number | null;
  roleIds:   string[];
}

export async function addXP(
  userId:        string,
  guildId:       string,
  source:        XPSource,
  customAmount?: number
): Promise<AddXPResult | null> {

  // Cooldown only for message/voice
  if (source === "message" || source === "voice") {
    if (await hasXPCooldown(userId)) return null;
    await setXPCooldown(userId);
  }

  const base       = customAmount ?? XP_PER_ACTION[source];
  const multiplier = await getMultiplier(userId);
  const amount     = applyMultiplier(base, multiplier);

  return db.transaction(async tx => {
    // Ensure user exists
    await tx.insert(users).values({ id: userId }).onConflictDoNothing();

    // Fetch guild XP algorithm
    const [guild] = await tx
      .select({ xpAlgorithm: guilds.xpAlgorithm })
      .from(guilds)
      .where(eq(guilds.id, guildId));

    const algo = guild?.xpAlgorithm as XPAlgorithm | undefined;

    // Ensure guild member exists
    await tx
      .insert(guildMembers)
      .values({ userId, guildId })
      .onConflictDoNothing();

    // Log XP
    await tx.insert(xpLog).values({ userId, guildId, source, amount });

    // Increment XP atomically
    const [updated] = await tx
      .update(guildMembers)
      .set({ xp: sql`${guildMembers.xp} + ${amount}` })
      .where(eq(guildMembers.userId, userId))
      .returning({ xp: guildMembers.xp, level: guildMembers.level });

    if (updated === undefined) throw new Error(`guildMember not found: ${userId}`);

    const newLevel  = calcLevel(updated.xp, algo);
    const leveledUp = newLevel > updated.level;
    const roleIds: string[] = [];

    if (leveledUp) {
      await tx
        .update(guildMembers)
        .set({ level: newLevel })
        .where(eq(guildMembers.userId, userId));

      // Fetch role rewards for all levels between old and new
      const rewards = await tx
        .select()
        .from(levelRewards)
        .where(eq(levelRewards.guildId, guildId));

      rewards
        .filter(r => r.level > updated.level && r.level <= newLevel)
        .forEach(r => roleIds.push(r.roleId));
    }

    return {
      xp:        updated.xp,
      level:     updated.level,
      leveledUp,
      newLevel:  leveledUp ? newLevel : null,
      roleIds
    };
  });
}

export async function getXPInfo(
  userId:  string,
  guildId: string
): Promise<{ xp: number; level: number } | null> {
  const [member] = await db
    .select({ xp: guildMembers.xp, level: guildMembers.level })
    .from(guildMembers)
    .where(eq(guildMembers.userId, userId));

  void guildId;
  return member ?? null;
}
