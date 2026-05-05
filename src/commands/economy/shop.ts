import { SlashCommandBuilder } from "discord.js";

import { getDailyShop, buyItem } from "../../modules/shop/shop.service";
import { EmbedStructure, ErrorEmbed, SuccessEmbed } from "../../shared/EmbedStructure";
import { getUserLang, t } from "../../i18n/index";

import type { Command } from "../../shared/types";

const RARITY_EMOJI: Record<string, string> = {
  common:    "⚪",
  rare:      "🔵",
  epic:      "🟣",
  legendary: "🟡"
};

export default {
  data: new SlashCommandBuilder()
    .setName("shop")
    .setDescription("View and buy items from the daily shop")
    .setDescriptionLocalizations({
      "pt-BR": "Veja e compre itens da loja diária"
    })
    .addSubcommand(s =>
      s.setName("view").setDescription("View items available today").setDescriptionLocalizations({
        "pt-BR": "Veja os itens disponíveis hoje"
      })
    )
    .addSubcommand(s =>
      s.setName("buy")
        .setDescription("Buy an item")
        .addIntegerOption(o =>
          o.setName("item_id").setDescription("Item ID").setDescriptionLocalizations({
            "pt-BR": "ID do item"
          }).setRequired(true)
        )
    ),

  async execute(interaction): Promise<void> {
    const lang = await getUserLang(interaction.user.id);
    const sub  = interaction.options.getSubcommand();
    const shop = t("command.shop", lang);

    if (sub === "view") {
      const items = await getDailyShop();

      if (items.length === 0) {
        await interaction.reply({
          embeds: [new ErrorEmbed(shop.error.no_items, lang)],
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedStructure({ color: "#FEE75C", lang })
        .setTitle(shop.embed.title)
        .setDescription(shop.embed.description)
        .addFields(
          items.map(item => ({
            name:   `${RARITY_EMOJI[item.rarity] ?? "⚪"} [ID: ${item.id}] ${item.name}`,
            value:  `${item.description ?? ""}\n💰 **${item.price} 🪙** • \`${item.rarity}\``,
            inline: false
          }))
        );

      await interaction.reply({ embeds: [embed] });
    }

    if (sub === "buy") {
      const itemId = interaction.options.getInteger("item_id", true);
      const result = await buyItem(interaction.user.id, itemId);

      if (!result.success) {
        await interaction.reply({
          embeds:    [new ErrorEmbed(t(result.reason ?? "error.generic", lang), lang)],
          ephemeral: true
        });
        return;
      }

      await interaction.reply({
        embeds: [new SuccessEmbed(shop.success.replace("{id}", itemId.toString()), lang)]
      });
    }
  }
} satisfies Command;
