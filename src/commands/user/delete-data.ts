import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction
} from "discord.js";
import { eq } from "drizzle-orm";

import { db }                 from "../../db/client";
import { users, guildMembers, userMissions, inventories, equippedBadges, xpLog, subscriptions, subscriptionLog } from "../../db/schema/index";
import { WarnEmbed, SuccessEmbed, ErrorEmbed } from "../../shared/EmbedStructure";
import { getUserLang, t }     from "../../i18n/index";

import type { Command } from "../../shared/types";

export default {
  data: new SlashCommandBuilder()
    .setName("delete-data")
    .setDescription("Delete all your data from BankBot (profile, inventory, missions, etc.)")
    .setDescriptionLocalizations({
      "pt-BR": "Exclui todos os seus dados do BankBot permanentemente"
    }),

  async execute(interaction): Promise<void> {
    const lang = await getUserLang(interaction.user.id);
    const delete_data = t("command.delete_data", lang);

    const embed = new WarnEmbed(delete_data.confirm, lang)
      .setTitle(delete_data.title)
      .setDescription(delete_data.description.join("\n"));

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("delete_confirm")
        .setLabel(delete_data.confirm)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("delete_cancel")
        .setLabel(delete_data.cancel)
        .setStyle(ButtonStyle.Secondary)
    );

    const reply = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true, withResponse: true });

    const collector = reply.resource?.message?.createMessageComponentCollector({
      filter: (i): i is ButtonInteraction => i.user.id === interaction.user.id,
      time:   30_000,
      max:    1
    });

    if (!collector) {
      await interaction.editReply({ content: `${delete_data.error}\n\`[DiscordJSError]: No collector for the response\``, embeds: [], components: [] });
      return;
    }

    collector.on("collect", async (btn: ButtonInteraction) => {
      if (btn.customId === "delete_confirm") {
        const userId = interaction.user.id;

        await db.transaction(async tx => {
          await tx.delete(equippedBadges).where(eq(equippedBadges.userId, userId));
          await tx.delete(inventories).where(eq(inventories.userId, userId));
          await tx.delete(userMissions).where(eq(userMissions.userId, userId));
          await tx.delete(xpLog).where(eq(xpLog.userId, userId));
          await tx.delete(subscriptions).where(eq(subscriptions.userId, userId));
          await tx.delete(subscriptionLog).where(eq(subscriptionLog.userId, userId));
          await tx.delete(guildMembers).where(eq(guildMembers.userId, userId));
          await tx.delete(users).where(eq(users.id, userId));
        });

        await btn.update({
          embeds:     [new SuccessEmbed(delete_data.success, lang)],
          components: []
        });
      } else {
        await btn.update({ content: delete_data.canceled, embeds: [], components: [] });
      }
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        await interaction.editReply({ content: delete_data.time_expired, embeds: [], components: [] });
      }
    });
  }
} satisfies Command;
