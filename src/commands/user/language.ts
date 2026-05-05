import { SlashCommandBuilder } from "discord.js";
import { eq }                  from "drizzle-orm";

import { db }                  from "../../db/client";
import { users }               from "../../db/schema/index";
import { SuccessEmbed }        from "../../shared/EmbedStructure";
import { getUserLang }         from "../../i18n/index";

import type { Command } from "../../shared/types";

export default {
  data: new SlashCommandBuilder()
    .setName("language")
    .setDescription("Set your language")
    .setDescriptionLocalizations({
      "pt-BR": "Defina seu idioma"
    })
    .addStringOption(o =>
      o.setName("lang")
      .setDescription("Language")
        .setDescriptionLocalizations({
          "pt-BR": "Idioma / Language",
        })
        .setRequired(true)
        .addChoices(
          { name: "🇧🇷 Português (Oficial)", value: "pt" },
          { name: "🇺🇸 English (May contain errors)",   value: "en" }
        )
    ),

  async execute(interaction): Promise<void> {
    const lang    = interaction.options.getString("lang", true) as "pt" | "en";
    const userId  = interaction.user.id;

    await db
      .insert(users)
      .values({ id: userId, language: lang })
      .onConflictDoUpdate({ target: users.id, set: { language: lang } });

    const messages = {
      pt: "Idioma definido para **Português** 🇧🇷",
      en: "Language set to **English** 🇺🇸"
    };

    await interaction.reply({
      embeds:    [new SuccessEmbed(messages[lang], lang)],
      ephemeral: true
    });
  }
} satisfies Command;
