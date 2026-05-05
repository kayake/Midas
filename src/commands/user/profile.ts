import { SlashCommandBuilder, AttachmentBuilder } from "discord.js";

import { renderProfileCard }   from "../../modules/profile/profile.render";
import { getUserPlan }         from "../../modules/subscription/subscription.service";
import { getUserLang, t }         from "../../i18n/index";
import { ErrorEmbed }          from "../../shared/EmbedStructure";
import { getCachedProfile, setCachedProfile } from "../../db/redis";

import type { Command } from "../../shared/types";

export default {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View a user's profile card")
    .setDescriptionLocalizations({
      "pt-BR": "Veja o card de perfil de um usuário",
    })
    .addUserOption(o =>
      o.setName("user")
      .setDescription("User (default: you)")
      .setDescriptionLocalizations({
        "pt-BR": "Usuário (padrão: você)",
      })
      .setRequired(false)
    ),

  async execute(interaction): Promise<void> {
    const lang    = await getUserLang(interaction.user.id);
    const target  = interaction.options.getUser("user") ?? interaction.user;
    const guildId = interaction.guildId!;

    await interaction.deferReply();

    // Cache check (5 min)
    const cacheKey    = `profile:card:${target.id}:${guildId}`;
    const cachedEntry = await getCachedProfile(cacheKey);

    let imageBuffer: Buffer;

    if (cachedEntry !== null) {
      imageBuffer = Buffer.from(cachedEntry, "base64");
    } else {
      const planId = await getUserPlan(target.id);

      try {
        imageBuffer = await renderProfileCard({
          userId:    target.id,
          username:  target.username,
          avatarUrl: target.displayAvatarURL({ size: 256, extension: "png" }),
          guildId,
          planId
        });

        // Cache as base64
        await setCachedProfile(cacheKey, imageBuffer.toString("base64"));
      } catch (err) {
        await interaction.editReply({
          embeds: [new ErrorEmbed(t("profile.error.generate", lang), lang)]
        });
        return;
      }
    }

    const attachment = new AttachmentBuilder(imageBuffer, { name: "profile.png" });
    await interaction.editReply({ files: [attachment] });
  }
} satisfies Command;
