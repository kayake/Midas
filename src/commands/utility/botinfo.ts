import { SlashCommandBuilder } from "discord.js";

import { db }                     from "../../db/client";
import { users, commandMetrics }  from "../../db/schema/index";
import { EmbedStructure }         from "../../shared/EmbedStructure";
import { getUserLang, t }            from "../../i18n/index";
import { statsGetGuilds, statsGetUsers, statsSetGuilds } from "../../db/redis";
import { getTopCommands }         from "../../modules/metrics/metrics.service";
import { sql }                    from "drizzle-orm";

import type { Command } from "../../shared/types";

export default {
  data: new SlashCommandBuilder()
    .setName("botinfo")
    .setDescription("Show information about the bot")
    .setDescriptionLocalizations({
      "pt-BR": "Mostra informações sobre o bot"
    }),

  async execute(interaction): Promise<void> {
    const lang = await getUserLang(interaction.user.id);
    const botinfo = t("command.botinfo", lang);

    await interaction.deferReply();

    // Guild count — from Discord client (accurate)
    const guildCount = interaction.client.guilds.cache.size;
    await statsSetGuilds(guildCount);

    // User count from DB
    const [userRow] = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
    const userCount  = userRow?.count ?? 0;

    // Top 3 commands
    const topCommands = await getTopCommands(3);
    const topStr      = topCommands.length > 0
      ? topCommands.map((c, i) => `${i + 1}. \`/${c.command}\` — ${c.useCount.toLocaleString()}x`).join("\n")
      : (botinfo.no_commands || "No command usage data available.");

    // Uptime
    const uptimeMs  = process.uptime() * 1000;
    const uptimeStr = formatUptime(uptimeMs);

    const embed = new EmbedStructure({ color: "#5865F2", lang })
      .setTitle(botinfo.title)
      .setDescription(
        botinfo.description.replace("{prefix}", "/").replace("{bot}", interaction.client.user?.username ?? "Midas")
      )
      .setThumbnail(interaction.client.user?.displayAvatarURL() ?? "")
      .addFields(
        { name: botinfo.guilds, value: `\`${guildCount.toLocaleString()}\``,  inline: true },
        { name: botinfo.users,   value: `\`${userCount.toLocaleString()}\``,   inline: true },
        { name: botinfo.uptime,     value: uptimeStr,                              inline: true },
        { name: botinfo.plans,    value: "HSBC · Barclays · Deutsche · UBS",    inline: true },
        { name: botinfo.top_commands, value: topStr, inline: false }
      );

    await interaction.editReply({ embeds: [embed] });
  }
} satisfies Command;

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}