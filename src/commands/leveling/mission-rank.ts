import {
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  type ButtonInteraction,
  type Client
} from "discord.js";
import { and, eq, gte, count, sql } from "drizzle-orm";

import { db }                   from "../../db/client";
import { userMissions, users, guildMembers } from "../../db/schema/index";
import { renderMissionRank }    from "../../modules/missions/mission-rank.render";
import { getUserLang, t }          from "../../i18n/index";

import type { Command }          from "../../shared/types";
import type { MissionRankEntry } from "../../modules/missions/mission-rank.render";

const PER_PAGE = 10;

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Fetch mission completion counts for today, ordered by most completed
async function fetchPage(
  guildId:  string,
  page:     number,
  viewerId: string
): Promise<{ entries: MissionRankEntry[]; total: number }> {
  const today  = todayStart();
  const offset = (page - 1) * PER_PAGE;

  // Aggregate by userId for this guild today
  const rows = await db
    .select({
      userId:    userMissions.userId,
      completed: sql<number>`COUNT(*) FILTER (WHERE ${userMissions.completed} = true)`,
      claimed:   sql<number>`COUNT(*) FILTER (WHERE ${userMissions.claimedAt} IS NOT NULL)`,
      total:     sql<number>`COUNT(*)`
    })
    .from(userMissions)
    .where(
      and(
        eq(userMissions.guildId, guildId),
        gte(userMissions.assignedAt, today)
      )
    )
    .groupBy(userMissions.userId)
    .orderBy(sql`COUNT(*) FILTER (WHERE ${userMissions.completed} = true) DESC`)
    .limit(PER_PAGE)
    .offset(offset);

  // Count distinct users with missions today
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${userMissions.userId})` })
    .from(userMissions)
    .where(and(eq(userMissions.guildId, guildId), gte(userMissions.assignedAt, today)));

  const total = countRow?.count ?? 0;

  // Build entries — streak is computed from consecutive days
  const entries: MissionRankEntry[] = await Promise.all(
    rows.map(async (r, i) => {
      const [userRow] = await db
        .select({ bio: users.bio, backgroundId: users.backgroundId, profileColorId: users.profileColorId })
        .from(users)
        .where(eq(users.id, r.userId));

      const streak = await calcStreak(r.userId, guildId);

      return {
        rank:           offset + i + 1,
        userId:         r.userId,
        username:       r.userId,
        avatarUrl:      "",
        completed:      r.completed,
        claimed:        r.claimed,
        streak,
        isViewer:       r.userId === viewerId,
        backgroundId:   userRow?.backgroundId,
        profileColorId: userRow?.profileColorId
      } satisfies MissionRankEntry;
    })
  );

  return { entries, total };
}

// Count consecutive days where user completed at least 1 mission
async function calcStreak(userId: string, guildId: string): Promise<number> {
  let streak = 0;
  const now  = new Date();

  for (let daysBack = 0; daysBack < 30; daysBack++) {
    const start = new Date(now);
    start.setDate(start.getDate() - daysBack);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const [row] = await db
      .select({ c: sql<number>`COUNT(*) FILTER (WHERE ${userMissions.completed} = true)` })
      .from(userMissions)
      .where(
        and(
          eq(userMissions.userId, userId),
          eq(userMissions.guildId, guildId),
          gte(userMissions.assignedAt, start)
        )
      );

    if ((row?.c ?? 0) > 0) {
      streak++;
    } else if (daysBack > 0) {
      break; // streak broken
    }
  }

  return streak;
}

async function resolveUsers(client: Client, entries: MissionRankEntry[]): Promise<MissionRankEntry[]> {
  return Promise.all(entries.map(async e => {
    try {
      const u     = await client.users.fetch(e.userId);
      e.username  = u.username;
      e.avatarUrl = u.displayAvatarURL({ size: 64, extension: "png" });
    } catch {
      e.username = `User ${e.userId.slice(0, 6)}`;
    }
    return e;
  }));
}

function buildButtons(p: number, total: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("mr_first").setEmoji("⏮️").setStyle(ButtonStyle.Secondary).setDisabled(p === 1),
    new ButtonBuilder().setCustomId("mr_prev").setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(p === 1),
    new ButtonBuilder().setCustomId("mr_ind").setLabel(`${p} / ${total}`).setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId("mr_next").setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(p >= total),
    new ButtonBuilder().setCustomId("mr_last").setEmoji("⏭️").setStyle(ButtonStyle.Secondary).setDisabled(p >= total)
  );
}

export default {
  data: new SlashCommandBuilder()
    .setName("missions-rank")
    .setDescription("See the ranking of mission completions for today")
    .setDescriptionLocalizations({
      "pt-BR": "Veja o ranking de missões completadas hoje"
    })
    .addIntegerOption(o =>
      o.setName("page").setDescription("Initial page").setDescriptionLocalizations({
        "pt-BR": "Página inicial"
      }).setRequired(false).setMinValue(1)
    ),

  async execute(interaction): Promise<void> {
    const lang      = await getUserLang(interaction.user.id) as "pt" | "en";
    const guildId   = interaction.guildId!;
    const viewerId  = interaction.user.id;
    const guildName = interaction.guild?.name ?? "Server";
    let   page      = interaction.options.getInteger("page") ?? 1;
    const mission_rank = t("command.mission_rank", lang);

    await interaction.deferReply();

    let { entries, total } = await fetchPage(guildId, page, viewerId);
    let   totalPages       = Math.max(1, Math.ceil(total / PER_PAGE));
    page                   = Math.min(page, totalPages);

    if (entries.length === 0) {
      await interaction.editReply({
        content: mission_rank.not_found
      });
      return;
    }

    entries = await resolveUsers(interaction.client, entries);

    const buf   = await renderMissionRank(entries, page, totalPages, guildName, lang);
    const att   = new AttachmentBuilder(buf, { name: "missions-rank.png" });
    const reply = await interaction.editReply({
      files:      [att],
      components: totalPages > 1 ? [buildButtons(page, totalPages)] : []
    });

    if (totalPages <= 1) return;

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter:        (i): i is ButtonInteraction => i.user.id === viewerId,
      time:          120_000
    });

    collector.on("collect", async (btn: ButtonInteraction) => {
      await btn.deferUpdate();
      const prev = page;
      if (btn.customId === "mr_first") page = 1;
      if (btn.customId === "mr_prev")  page = Math.max(1, page - 1);
      if (btn.customId === "mr_next")  page = Math.min(totalPages, page + 1);
      if (btn.customId === "mr_last")  page = totalPages;
      if (page === prev) return;

      let { entries: e2, total: t2 } = await fetchPage(guildId, page, viewerId);
      totalPages = Math.max(1, Math.ceil(t2 / PER_PAGE));
      e2 = await resolveUsers(btn.client, e2);
      const buf2 = await renderMissionRank(e2, page, totalPages, guildName, lang);
      await btn.editReply({
        files:      [new AttachmentBuilder(buf2, { name: "missions-rank.png" })],
        components: [buildButtons(page, totalPages)]
      });
    });

    collector.on("end", async () => {
      try { await interaction.editReply({ components: [] }); } catch { /**/ }
    });
  }
} satisfies Command;