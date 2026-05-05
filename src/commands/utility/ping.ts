import { SlashCommandBuilder } from "discord.js";

import { db } from "../../db/client";
import { EmbedStructure } from "../../shared/EmbedStructure";
import { getUserLang, t } from "../../i18n/index";
import { users } from "../../db/schema/index";

import type { Command } from "../../shared/types";

export default {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Show the bot's latency")
    .setDescriptionLocalizations({
      "pt-BR": "Mostra a latência do bot"
    }),

  async execute(interaction): Promise<void> {
    const lang = await getUserLang(interaction.user.id);

    await interaction.deferReply();

    // API ping
    const sent      = await interaction.fetchReply();
    const apiPing   = sent.createdTimestamp - interaction.createdTimestamp;

    // DB ping
    const dbStart = Date.now();
    await db.select().from(users).limit(1);
    const dbPing  = Date.now() - dbStart;

    const wsPing  = interaction.client.ws.ping;

    const embed = new EmbedStructure({ lang })
      .setTitle("🏓 Pong!")
      .addFields(
        { name: `📡 ${t("ping.ws", lang)}`,  value: `\`${wsPing}ms\``,  inline: true },
        { name: `🌐 ${t("ping.api", lang)}`,  value: `\`${apiPing}ms\``, inline: true },
        { name: `🗄️ ${t("ping.db", lang)}`,   value: `\`${dbPing}ms\``,  inline: true }
      );

    await interaction.editReply({ embeds: [embed] });
  }
} satisfies Command;
