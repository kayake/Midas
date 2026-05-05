import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

import { EmbedStructure } from "../../shared/EmbedStructure";
import { getUserLang, t }    from "../../i18n/index";

import type { Command } from "../../shared/types";

export default {
  data: new SlashCommandBuilder()
    .setName("privacy")
    .setDescription("Read and accept the privacy policy of BankBot")
    .setDescriptionLocalizations({
      "pt-BR": "Leia e aceite a política de privacidade do BankBot",
    }),

  async execute(interaction): Promise<void> {
    const lang = await getUserLang(interaction.user.id);
    const privacy = t("command.privacy", lang);

    const embed = new EmbedStructure({ color: "#5865F2", lang })
      .setTitle(privacy.title)
      .setDescription(privacy.description.join("\n"));

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("privacy_accept")
        .setLabel(`✅ ${privacy.button.accept}`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("privacy_decline")
        .setLabel(`❌ ${privacy.button.decline}`)
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
} satisfies Command;
