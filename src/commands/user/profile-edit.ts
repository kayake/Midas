import { SlashCommandBuilder } from "discord.js";
import { and, eq }             from "drizzle-orm";

import { db }                  from "../../db/client";
import {
  equippedBadges,
  inventories,
  shopItems,
  users
} from "../../db/schema/index";
import { SuccessEmbed, ErrorEmbed } from "../../shared/EmbedStructure";
import { getUserLang, t }         from "../../i18n/index";
import { invalidateProfileCache } from "../../db/redis";

import type { Command } from "../../shared/types";

const MAX_BADGE_SLOTS = 3;

async function ownsItem(userId: string, itemId: number): Promise<boolean> {
  const [row] = await db
    .select({ itemId: inventories.itemId })
    .from(inventories)
    .where(and(eq(inventories.userId, userId), eq(inventories.itemId, itemId)));
  return row !== undefined;
}

async function getItem(itemId: number): Promise<typeof shopItems.$inferSelect | null> {
  const [item] = await db.select().from(shopItems).where(eq(shopItems.id, itemId));
  return item ?? null;
}

export default {
  data: new SlashCommandBuilder()
    .setName("profile-edit")
    .setDescription("Customize your profile")
    .setDescriptionLocalizations({
      "pt-BR": "Personalize seu perfil",
    })
    .addStringOption(o =>
      o.setName("item")
        .setDescription("What to edit")
        .setDescriptionLocalizations({
          "pt-BR": "O que editar",
        })
        .setRequired(true)
        .addChoices(
          { name: "Bio", value: "bio" },
          { name: "Wallpaper", value: "wallpaper" },
          { name: "Color", value: "color" },
          { name: "Badge", value: "badge" },
          { name: "Background", value: "background" },
          { name: "Title", value: "title" }
        )
    ).addStringOption(o =>
      o.setName("argument")
      .setNameLocalizations({
        "pt-BR": "argumento"
      })
        .setDescription("Argument for the edit (e.g. new bio text, item ID to equip, etc.)")
        .setDescriptionLocalizations({
          "pt-BR": "Argumento para a edição (ex: novo texto para a bio, ID do item para equipar, etc.)",
        })
        .setRequired(false)
    ),

  async execute(interaction): Promise<any> {
    const lang    = await getUserLang(interaction.user.id);
    const userId  = interaction.user.id;
    const guildId = interaction.guildId!;
    const sub     = interaction.options.getString("item", true);
    const argument = interaction.options.getString("argument") ?? null;

    const profile_edit = t("command.profile_edit", lang);

    const functions: { [key: string]: string } = {
      "bio": "bio",
      "wallpaper": "wallpaper",
      "color": "profileColorId",
      "background": "backgroundId",
      "title": "title"
    }

    if (sub === "bio") {
      if (!argument || argument.length > 32) {
        return interaction.reply({
          embeds: [new ErrorEmbed(profile_edit.error["bio_max_length"].replace("{max}", "32"), lang)],
          ephemeral: true
        });
      }
    } else if (sub === "badge") {
       const currentBadges = await db
          .select({ slot: equippedBadges.slot })
          .from(equippedBadges)
          .where(eq(equippedBadges.userId, userId));

        const usedSlots = new Set(currentBadges.map(b => b.slot));
        let freeSlot    = -1;
        for (let i = 0; i < MAX_BADGE_SLOTS; i++) {
          if (!usedSlots.has(i)) { freeSlot = i; break; }
        }

        if (freeSlot === -1) return interaction.reply({
          embeds: [new ErrorEmbed(profile_edit.error["badge_max_length"].replace("{max}", MAX_BADGE_SLOTS.toString()), lang)],
          ephemeral: true
        });

        const itemId = parseInt(argument ?? "");
        if (isNaN(itemId)) return interaction.reply({
          embeds: [new ErrorEmbed(profile_edit.error["invalid_argument"].replace("{sub}", sub), lang)],
          ephemeral: true
        });

        const item = await getItem(itemId);
        if (item === null || item.type !== "badge") return interaction.reply({
          embeds: [new ErrorEmbed(profile_edit.error["item_not_owned"], lang)],
          ephemeral: true
        });

        const alreadyEquipped = await db
          .select()
          .from(equippedBadges)
          .where(and(eq(equippedBadges.userId, userId), eq(equippedBadges.shopItemId, itemId)));

        if (alreadyEquipped) {
         await db
          .delete(equippedBadges)
          .where(and(eq(equippedBadges.userId, userId), eq(equippedBadges.shopItemId, itemId)));
        }

        await db.insert(equippedBadges).values({
          userId,
          shopItemId: itemId,
          slot:       freeSlot
        });

        await invalidateProfileCache(`profile:card:${userId}:${guildId}`);
        return interaction.reply({
          embeds: [new SuccessEmbed(profile_edit.success["badge_equipped"].replace("{name}", item.name).replace("{action}", alreadyEquipped ? "removida" : "equipada"), lang)],
          ephemeral: true
        });

      }

    if (!isNaN(Number(argument))) {
      if (argument && !await ownsItem(userId, parseInt(argument))) {
        return interaction.reply({
          embeds: [new ErrorEmbed(profile_edit.error["item_not_owned"], lang)],
          ephemeral: true
        });
      }
    } else {
      return interaction.reply({
        embeds: [new ErrorEmbed(profile_edit.error["invalid_argument"].replace("{sub}", sub), lang)],
        ephemeral: true
      });
    }

    await db.update(users).set({ [functions[sub]]: argument })
    
    await invalidateProfileCache(`profile:card:${userId}:${guildId}`);

    await interaction.reply({
      embeds: [new SuccessEmbed(profile_edit.success["profile_updated"].replace("{sub}", sub).replace("{argument}", argument), lang)],
      ephemeral: true
    });
  }
} satisfies Command;