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
import { eq } from "drizzle-orm";

import { lbGetXP, lbCountXP } from "../../db/redis";
import { db }                  from "../../db/client";
import { guildMembers, users } from "../../db/schema/index";
import { renderXPRank }        from "../../modules/leveling/xp-rank.render";
import { getUserLang }         from "../../i18n/index";
import { calcLevel }           from "../../modules/leveling/xp.config";

import type { Command }     from "../../shared/types";
import type { XPRankEntry } from "../../modules/leveling/xp-rank.render";

const PER_PAGE = 10;

async function fetchPage(guildId: string, page: number, viewerId: string): Promise<{ entries: XPRankEntry[]; total: number }> {
  const [rows, total] = await Promise.all([lbGetXP(guildId, page, PER_PAGE), lbCountXP(guildId)]);
  const entries: XPRankEntry[] = await Promise.all(rows.map(async (r, i) => {
    const [userRow]   = await db.select({ bio: users.bio, backgroundId: users.backgroundId, profileColorId: users.profileColorId }).from(users).where(eq(users.id, r.userId));
    const [memberRow] = await db.select({ level: guildMembers.level }).from(guildMembers).where(eq(guildMembers.userId, r.userId));
    return { rank: (page-1)*PER_PAGE+i+1, userId: r.userId, username: r.userId, avatarUrl: "", xp: r.score, level: memberRow?.level ?? calcLevel(r.score), isViewer: r.userId === viewerId, bio: userRow?.bio, backgroundId: userRow?.backgroundId, profileColorId: userRow?.profileColorId } satisfies XPRankEntry;
  }));
  return { entries, total };
}

async function resolveUsers(client: Client, entries: XPRankEntry[]): Promise<XPRankEntry[]> {
  return Promise.all(entries.map(async e => {
    try { const u = await client.users.fetch(e.userId); e.username = u.username; e.avatarUrl = u.displayAvatarURL({ size: 64, extension: "png" }); } catch { e.username = `User ${e.userId.slice(0,6)}`; }
    return e;
  }));
}

function buildButtons(p: number, total: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("xp_first").setEmoji("⏮️").setStyle(ButtonStyle.Secondary).setDisabled(p===1),
    new ButtonBuilder().setCustomId("xp_prev").setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(p===1),
    new ButtonBuilder().setCustomId("xp_ind").setLabel(`${p} / ${total}`).setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId("xp_next").setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(p>=total),
    new ButtonBuilder().setCustomId("xp_last").setEmoji("⏭️").setStyle(ButtonStyle.Secondary).setDisabled(p>=total)
  );
}

export default {
  data: new SlashCommandBuilder()
    .setName("xp-rank")
    .setDescription("Server XP ranking with progress bar")
    .setDescriptionLocalizations({
      "pt-BR": "Ranking de XP do servidor com progress bar"
    })
    .addIntegerOption(o => o.setName("page").setDescription("Initial page").setDescriptionLocalizations({
      "pt-BR": "Página inicial"
    }).setRequired(false).setMinValue(1)),

  async execute(interaction): Promise<void> {
    const lang      = await getUserLang(interaction.user.id) as "pt" | "en";
    const guildId   = interaction.guildId!;
    const viewerId  = interaction.user.id;
    const guildName = interaction.guild?.name ?? "Server";
    let   page      = interaction.options.getInteger("page") ?? 1;

    await interaction.deferReply();

    let { entries, total } = await fetchPage(guildId, page, viewerId);
    let   totalPages       = Math.max(1, Math.ceil(total / PER_PAGE));
    page                   = Math.min(page, totalPages);
    entries                = await resolveUsers(interaction.client, entries);

    const buf   = await renderXPRank(entries, page, totalPages, guildName, lang);
    const att   = new AttachmentBuilder(buf, { name: "xp-rank.png" });
    const reply = await interaction.editReply({ files: [att], components: totalPages > 1 ? [buildButtons(page, totalPages)] : [] });
    if (totalPages <= 1) return;

    const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, filter: (i): i is ButtonInteraction => i.user.id === viewerId, time: 120_000 });
    collector.on("collect", async (btn: ButtonInteraction) => {
      await btn.deferUpdate();
      const prev = page;
      if (btn.customId === "xp_first") page = 1;
      if (btn.customId === "xp_prev")  page = Math.max(1, page - 1);
      if (btn.customId === "xp_next")  page = Math.min(totalPages, page + 1);
      if (btn.customId === "xp_last")  page = totalPages;
      if (page === prev) return;
      let { entries: e2, total: t2 } = await fetchPage(guildId, page, viewerId);
      totalPages = Math.max(1, Math.ceil(t2 / PER_PAGE));
      e2 = await resolveUsers(btn.client, e2);
      const buf2 = await renderXPRank(e2, page, totalPages, guildName, lang);
      await btn.editReply({ files: [new AttachmentBuilder(buf2, { name: "xp-rank.png" })], components: [buildButtons(page, totalPages)] });
    });
    collector.on("end", async () => { try { await interaction.editReply({ components: [] }); } catch { /**/ } });
  }
} satisfies Command;