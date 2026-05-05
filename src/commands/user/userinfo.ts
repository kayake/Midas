import { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder } from "discord.js";
import { eq, and } from "drizzle-orm";

import { db }                from "../../db/client";
import { users, guildMembers, serverCurrencies } from "../../db/schema/index";
import { EmbedStructure }    from "../../shared/EmbedStructure";
import { getUserLang, t }       from "../../i18n/index";
import { getUserPlan }       from "../../modules/subscription/subscription.service";
import { getPlan }           from "../../shared/plans";
import { CENTRAL_CURRENCY }  from "../../shared/constants";

import type { Command } from "../../shared/types";
import { lbRankGlobal } from "../../db/redis";

export default {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Show information about a user")
    .setDescriptionLocalizations({
      "pt-BR": "Mostra informações de um usuário",
    })
    .addUserOption(o =>
      o.setName("user")
      .setDescription("User (default: you)")
      .setDescriptionLocalizations({
        "pt-BR": "Usuário (padrão: você)",
      }).setRequired(false)
    ),

  async execute(interaction): Promise<void> {
    const lang        = await getUserLang(interaction.user.id);
    const userinfo = t("command.userinfo", lang);
    const target      = interaction.options.getUser("user") ?? interaction.user;
    const guildId     = interaction.guildId!;

    const [userRow] = await db
      .select()
      .from(users)
      .where(eq(users.id, target.id));

    const [member] = await db
      .select()
      .from(guildMembers)
      .where(and(eq(guildMembers.userId, target.id), eq(guildMembers.guildId, guildId)));
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, target.id));

    const planId   = await getUserPlan(target.id);
    const plan     = getPlan(planId);

    const discordCreated = `<t:${Math.floor(target.createdTimestamp / 1000)}:F>`;
    const botCreated     = userRow?.createdAt !== undefined && userRow.createdAt !== null
      ? `<t:${Math.floor(new Date(userRow.createdAt).getTime() / 1000)}:F>`
      : "N/A";

    const embed = new EmbedStructure({ color: plan.color, lang })
      .setTitle(`👤 ${target.username}`)
      .setThumbnail(target.displayAvatarURL())
      .addFields(
        { name: "🆔 ID",                value: `\`${target.id}\``,                    inline: true  },
        { name: `🏦 ${t("plan", lang)}`,             value: `${plan.name} (${plan.label})`,         inline: true  },
        { name: `📅 ${userinfo.account.discord}`,     value: discordCreated,                          inline: false },
        { name: `🤖 ${userinfo.account.created}`,  value: botCreated,                             inline: false },
        { name: `⭐ ${userinfo.xp}`,                value: `\`${member?.xp ?? 0}\``,              inline: true  },
        { name: `🎯 ${userinfo.level}`,             value: `\`${member?.level ?? 1}\``,            inline: true  },
        { name: `${CENTRAL_CURRENCY.symbol} Coins`, value: `\`${user?.centralCoins?.toFixed(2) ?? "0.00"}\``, inline: true },
        { name: "Rank (Global)", value: `#\`${await lbRankGlobal(target.id)}\``, inline: true }
      );

    // Build currency select for server coins
    const currencies = await db.select().from(serverCurrencies);
    const userGuilds  = await db.select().from(guildMembers).where(eq(guildMembers.userId, target.id));

    const currencyOptions = userGuilds
      .map(gm => {
        const currency = currencies.find(c => c.guildId === gm.guildId);
        if (currency === undefined) return null;
        return new StringSelectMenuOptionBuilder()
          .setLabel(`${currency.name} (${currency.symbol})`)
          .setValue(gm.guildId)
          .setDescription(`${gm.serverCoins.toFixed(2)} ${currency.symbol}`);
      })
      .filter((o): o is StringSelectMenuOptionBuilder => o !== null);

    const components = [];
    if (currencyOptions.length > 0) {
      const select = new StringSelectMenuBuilder()
        .setCustomId("userinfo_currency")
        .setPlaceholder(userinfo.placeholder_coin)
        .addOptions(currencyOptions);
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
    }

    await interaction.reply({ embeds: [embed], components, ephemeral: false });
  }
} satisfies Command;
