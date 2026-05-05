import { SlashCommandBuilder } from "discord.js";
import { eq, and, inArray }    from "drizzle-orm";

import { db }                  from "../../db/client";
import { inventories, shopItems, equippedBadges, guildMembers, users } from "../../db/schema/index";
import { EmbedStructure, ErrorEmbed } from "../../shared/EmbedStructure";
import { getUserLang, t }         from "../../i18n/index";

import type { Command } from "../../shared/types";

const TYPE_EMOJI: Record<string, string> = {
  badge:      "🎖️",
  background: "🖼️",
  color:      "🎨",
  frame:      "🔲",
  role:       "🏷️"
};

const RARITY_EMOJI: Record<string, string> = {
  common:    "⬜",
  rare:      "🟦",
  epic:      "🟣",
  legendary: "🟡"
};

export default {
  data: new SlashCommandBuilder()
    .setName("inventory")
    .setDescription("View your items: badges, wallpapers and profile colors")
    .setDescriptionLocalizations({
      "pt-BR": "Veja seus itens: badges, wallpapers e cores de perfil",
    })
    .addStringOption(o =>
      o.setName("filter")
      .setDescription("Filter by item type")
        .setDescriptionLocalizations({
          "pt-BR": "Filtrar por tipo de item",
        })
        .setRequired(false)
        .addChoices(
          { name: "🎖️ Badges",      value: "badge"      },
          { name: "🖼️ Wallpapers",  value: "background" },
          { name: "🎨 Cores",        value: "color"      },
          { name: "🔲 Frames",       value: "frame"      },
          { name: "📦 Todos",        value: "all"        }
        )
    ),

  async execute(interaction): Promise<void> {
    const lang    = await getUserLang(interaction.user.id);
    const userId  = interaction.user.id;
    const guildId = interaction.guildId!;
    const filter  = interaction.options.getString("filter") ?? "all";
    const inv = t("command.inventory", lang);

    await interaction.deferReply({ ephemeral: true });

    // Fetch inventory
    const ownedRows = await db
      .select({ itemId: inventories.itemId, source: inventories.source, boughtAt: inventories.boughtAt })
      .from(inventories)
      .where(eq(inventories.userId, userId));

    if (ownedRows.length === 0) {
      await interaction.editReply({
        embeds: [new ErrorEmbed(inv.empty, lang)]
      });
      return;
    }

    const itemIds  = ownedRows.map(r => r.itemId);
    let allItems   = await db
      .select()
      .from(shopItems)
      .where(inArray(shopItems.id, itemIds));

    // Filter
    if (filter !== "all") {
      allItems = allItems.filter(i => i.type === filter);
    }

    if (allItems.length === 0) {
      await interaction.editReply({
        embeds: [new ErrorEmbed(inv.no_items, lang)]
      });
      return;
    }

    // Fetch equipped items for this user
    const equipped = await db
      .select()
      .from(equippedBadges)
      .where(eq(equippedBadges.userId, userId));

    const [member] = await db
      .select({ backgroundId: users.backgroundId, profileColorId: users.profileColorId, frameId: users.frameId })
      .from(users)
      .where(eq(users.id, userId));

    const equippedBadgeIds    = new Set(equipped.map(e => e.shopItemId));
    const equippedBgId        = member?.backgroundId    ?? null;
    const equippedColorId     = member?.profileColorId  ?? null;
    const equippedFrameId     = member?.frameId         ?? null;

    // Group by type
    const grouped = allItems.reduce<Record<string, typeof allItems>>((acc, item) => {
      acc[item.type] = acc[item.type] ?? [];
      acc[item.type]!.push(item);
      return acc;
    }, {});

    const embed = new EmbedStructure({ lang })
      .setTitle(inv.title)
      .setDescription(inv.description.replace("{help}", inv.help[0]).replace("{items}", inv.type[filter] ?? "items").replace("{length}", allItems.length.toString()));

    for (const [type, items] of Object.entries(grouped)) {
      const typeEmoji = TYPE_EMOJI[type] ?? "📦";
      const lines     = items.map(item => {
        const owned  = ownedRows.find(r => r.itemId === item.id);
        const source = owned?.source === "mission" ? ` *(${inv.mission})*` : "";

        let equipped = "";
        if (type === "badge"      && equippedBadgeIds.has(item.id))  equipped = inv.equipped_badge;
        if (type === "background" && equippedBgId    === item.id)    equipped = inv.equipped_background;
        if (type === "color"      && equippedColorId === item.id)    equipped = inv.equipped_color;
        if (type === "frame"      && equippedFrameId === item.id)    equipped = inv.equipped_frame;

        const colorPreview = item.type === "color" && item.colorValue !== null
          ? `  \`${item.colorValue.slice(0, 30)}\``
          : "";

        return `${RARITY_EMOJI[item.rarity] ?? "⬜"} \`ID: ${item.id}\` **${item.name}**${equipped}${source}${colorPreview}`;
      });

      embed.addFields({
        name:   `${typeEmoji} ${type.charAt(0).toUpperCase() + type.slice(1)}s (${items.length})`,
        value:  lines.join("\n").slice(0, 1024),
        inline: false
      });
    }

    embed.addFields({
      name:  inv.how_to_use,
      value: inv.help.join("\n"),
      inline: false
    });

    await interaction.editReply({ embeds: [embed] });
  }
} satisfies Command;