import { and, eq, gte } from "drizzle-orm";

import { db }                   from "../../db/client";
import { userMissions, inventories, activeSeason, serverCurrencies } from "../../db/schema/index";
import { getMissionById, getMissionsForUser } from "./mission.loader";
import { getUserPlan }          from "../subscription/subscription.service";
import { addXP }                from "../leveling/xp.service";
import { addServerCoins }       from "../economy/currency.service";
import { getMissionResets, incrementMissionResets, lbSetServer } from "../../db/redis";
import { getPlan }              from "../../shared/plans";

import type { Mission } from "./mission.types";

// ─── Utils ────────────────────────────────────────────────────────────────────

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getActiveSeason(): Promise<string | undefined> {
  const [row] = await db
    .select({ season: activeSeason.season, expiresAt: activeSeason.expiresAt })
    .from(activeSeason)
    .orderBy(activeSeason.activatedAt)
    .limit(1);

  if (row === undefined || row.expiresAt < new Date()) return undefined;
  return row.season;
}

// ─── Daily seed shuffle ────────────────────────────────────────────────────────
// Same day + userId always produces the same shuffle — consistent per user per day
// but different from yesterday and from other users.

function dailySeed(userId: string): number {
  const today = new Date();
  const dateStr = `${today.getFullYear()}${today.getMonth()}${today.getDate()}`;
  let hash = 0;
  for (const ch of userId + dateStr) {
    hash = (Math.imul(31, hash) + ch.charCodeAt(0)) | 0;
  }
  return Math.abs(hash);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

// ─── Get assigned missions ────────────────────────────────────────────────────
// Picks 3 random missions per day (seeded by userId+date), always consistent.

export async function getAssignedMissions(
  userId:  string,
  guildId: string
): Promise<{ mission: Mission; progress: number; completed: boolean }[]> {
  const plan      = await getUserPlan(userId);
  const season    = await getActiveSeason();
  const available = await getMissionsForUser(plan, season);
  const today     = todayStart();

  // Shuffle deterministically for this user today, pick first N
  const seed      = dailySeed(userId);
  const shuffled  = seededShuffle(available, seed);
  // Always show all available missions (slot logic is handled in the command)
  const missions  = shuffled;

  const rows = await db
    .select()
    .from(userMissions)
    .where(
      and(
        eq(userMissions.userId, userId),
        eq(userMissions.guildId, guildId),
        gte(userMissions.assignedAt, today)
      )
    );

  return missions.map(mission => {
    const row = rows.find(r => r.missionId === mission.id);
    return {
      mission,
      progress:  row?.progress  ?? 0,
      completed: row?.completed ?? false
    };
  });
}

// ─── Update mission progress ──────────────────────────────────────────────────

export async function updateMissionProgress(
  userId:    string,
  guildId:   string,
  type:      string,
  increment: number
): Promise<{ justCompleted: Mission[] }> {
  const plan      = await getUserPlan(userId);
  const season    = await getActiveSeason();
  const available = await getMissionsForUser(plan, season);
  const today     = todayStart();

  const matching      = available.filter(m => m.type === type);
  const justCompleted: Mission[] = [];

  for (const mission of matching) {
    const [existing] = await db
      .select()
      .from(userMissions)
      .where(
        and(
          eq(userMissions.userId, userId),
          eq(userMissions.guildId, guildId),
          eq(userMissions.missionId, mission.id),
          gte(userMissions.assignedAt, today)
        )
      );

    if (existing?.completed === true) continue;

    const currentProgress = existing?.progress ?? 0;
    const newProgress     = Math.min(currentProgress + increment, mission.target);
    const nowCompleted    = newProgress >= mission.target;
    const wasCompleted    = existing?.completed ?? false;

    if (existing === undefined) {
      await db.insert(userMissions).values({
        userId,
        guildId,
        missionId: mission.id,
        progress:  newProgress,
        completed: nowCompleted,
        seasonal:  mission.seasonal
      });
    } else {
      await db
        .update(userMissions)
        .set({ progress: newProgress, completed: nowCompleted })
        .where(
          and(
            eq(userMissions.userId, userId),
            eq(userMissions.guildId, guildId),
            eq(userMissions.missionId, mission.id),
            gte(userMissions.assignedAt, today)
          )
        );
    }

    if (nowCompleted && !wasCompleted) {
      justCompleted.push(mission);
    }
  }

  return { justCompleted };
}

// ─── Claim mission reward ─────────────────────────────────────────────────────

export async function claimMissionReward(
  userId:    string,
  guildId:   string,
  missionId: number
): Promise<{ success: boolean; reason?: string }> {
  const mission = await getMissionById(missionId);
  if (mission === null) return { success: false, reason: "Mission not found." };

  const today = todayStart();
  const [row] = await db
    .select()
    .from(userMissions)
    .where(
      and(
        eq(userMissions.userId, userId),
        eq(userMissions.guildId, guildId),
        eq(userMissions.missionId, missionId),
        gte(userMissions.assignedAt, today)
      )
    );

  if (row === undefined || !row.completed) {
    return { success: false, reason: "mission_not_complete" };
  }
  if (row.claimedAt !== null) {
    return { success: false, reason: "mission_claimed" };
  }

  await db
    .update(userMissions)
    .set({ claimedAt: new Date() })
    .where(
      and(
        eq(userMissions.userId, userId),
        eq(userMissions.guildId, guildId),
        eq(userMissions.missionId, missionId),
        gte(userMissions.assignedAt, today)
      )
    );

  // Grant XP
  if (mission.xpReward > 0) {
    await addXP(userId, guildId, "mission", mission.xpReward);
  }

  // Grant server coins (mission rewards go to server currency if server has one)
  if (mission.coinReward > 0) {
    const [serverCurrency] = await db
      .select({ guildId: serverCurrencies.guildId })
      .from(serverCurrencies)
      .where(eq(serverCurrencies.guildId, guildId))
      .limit(1);

    if (serverCurrency !== undefined) {
      await addServerCoins(userId, guildId, mission.coinReward);

      // Update server leaderboard in Redis
      const { guildMembers } = await import("../../db/schema/index.js");
      const [member] = await db
        .select({ serverCoins: guildMembers.serverCoins })
        .from(guildMembers)
        .where(and(eq(guildMembers.userId, userId), eq(guildMembers.guildId, guildId)));

      if (member !== undefined) {
        await lbSetServer(guildId, userId, member.serverCoins);
      }
    }
  }

  // Grant item reward (badge)
  if (mission.itemRewardId !== null) {
    await db
      .insert(inventories)
      .values({ userId, itemId: mission.itemRewardId, source: "mission" })
      .onConflictDoNothing();
  }

  return { success: true };
}

// ─── Reset mission ────────────────────────────────────────────────────────────

export async function resetMission(
  userId:    string,
  guildId:   string,
  missionId: number
): Promise<{ success: boolean; reason?: string }> {
  const plan     = await getUserPlan(userId);
  const planData = getPlan(plan);
  const resets   = await getMissionResets(userId);

  if (planData.missionResets !== -1 && resets >= planData.missionResets) {
    return { success: false, reason: "mission.no_resets" };
  }

  const today = todayStart();

  await db
    .update(userMissions)
    .set({ progress: 0, completed: false, claimedAt: null })
    .where(
      and(
        eq(userMissions.userId, userId),
        eq(userMissions.guildId, guildId),
        eq(userMissions.missionId, missionId),
        gte(userMissions.assignedAt, today)
      )
    );

  await incrementMissionResets(userId);

  return { success: true };
}