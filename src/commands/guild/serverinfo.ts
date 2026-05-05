import { SlashCommandBuilder } from "discord.js";
import { eq }                  from "drizzle-orm";

import { db }                  from "../../db/client";
import { guilds, serverCurrencies } from "../../db/schema/index";
import { EmbedStructure }      from "../../shared/EmbedStructure";
import { getUserLang, t }         from "../../i18n/index";
import { getUserPlan }         from "../../modules/subscription/subscription.service";
import { getPlan }             from "../../shared/plans";
import { effectiveRate }       from "../../modules/economy/inflation.service";
import { computeAutoRate }     from "../../modules/economy/exchange.service";
import { CENTRAL_CURRENCY }    from "../../shared/constants";

import type { Command } from "../../shared/types";

export default {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Show information about this server")
    .setDescriptionLocalizations({
      "pt-BR": "Mostra informações sobre este servidor"
    }),

  async execute(interaction): Promise<void> {
    const lang      = await getUserLang(interaction.user.id);
    const guild     = interaction.guild!;
    const guildId   = guild.id;
    const serverInfo = t("command.serverinfo", lang)

    const [guildRow] = await db
      .select()
      .from(guilds)
      .where(eq(guilds.id, guildId));

    const [currency] = await db
      .select()
      .from(serverCurrencies)
      .where(eq(serverCurrencies.guildId, guildId));

    const ownerPlanId = guildRow?.ownerId !== undefined
      ? await getUserPlan(guildRow.ownerId)
      : "hsbc";
    const ownerPlan   = getPlan(ownerPlanId);

    const boostLevel  = guild.premiumTier;
    const boostCount  = guild.premiumSubscriptionCount ?? 0;

    // Currency display
    let currencyDisplay = "N/A";
    let inflationInfo   = "N/A";
    let centralRate     = "N/A";

    if (currency !== undefined) {
      const emojiStr = currency.emojiCreated && currency.emojiId !== null
        ? `<:${currency.name.toLowerCase().replace(/\s+/g, "_")}_${guildId}:${currency.emojiId}>`
        : currency.symbol;

      currencyDisplay = `${emojiStr} **${currency.name}** (${currency.symbol})`;

      const rate = effectiveRate(currency);
      inflationInfo = `${(rate * 100).toFixed(2)}%${currency.inflationOverride !== null ? " *(manual)*" : " *(auto)*"}`;

      const centralRateVal = await computeAutoRate(guildId, null);
      centralRate = `1 ${currency.symbol} = ${centralRateVal.toFixed(4)} ${CENTRAL_CURRENCY.symbol}`;
    }

    const embed = new EmbedStructure({ color: ownerPlan.color, lang })
      .setTitle(`🏛️ ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 1024 }) ?? null)
      .addFields(
        { name: serverInfo.id,              value: `\`${guildId}\``,                         inline: true  },
        { name: serverInfo.owner,            value: `<@${guild.ownerId}>`,                     inline: true  },
        { name: serverInfo.plan,   value: `${ownerPlan.name} (${ownerPlan.label})`, inline: true  },
        { name: serverInfo.boost_level,  value: `Tier ${boostLevel} (${boostCount} boosts)`, inline: true },
        { name: serverInfo.members,         value: `${guild.memberCount}`,                    inline: true  },
        { name: serverInfo.coin,           value: currencyDisplay,                           inline: false },
        { name: serverInfo.inflation,        value: inflationInfo,                             inline: true  },
        { name: serverInfo.exchange,          value: centralRate,                               inline: true  }
      );

    await interaction.reply({ embeds: [embed] });
  }
} satisfies Command;
