import { SlashCommandBuilder } from "discord.js";

import { computeAutoRate, recordRate } from "../../modules/economy/exchange.service";
import { EmbedStructure, ErrorEmbed }  from "../../shared/EmbedStructure";
import { getUserLang, t }              from "../../i18n/index";
import { db }                          from "../../db/client";
import { serverCurrencies }            from "../../db/schema/index";
import { CENTRAL_CURRENCY }            from "../../shared/constants";

import type { Command } from "../../shared/types";

export default {
  data: new SlashCommandBuilder()
    .setName("exchange")
    .setDescription("Show the exchange rate between two server currencies")
    .setDescriptionLocalizations({
      "pt-BR": "Mostra a taxa de câmbio entre duas moedas de servidor"
    })
    .addStringOption(o =>
      o.setName("coin1")
        .setDescription("ID of the source server (empty = central BankCoin)")
        .setDescriptionLocalizations({
          "pt-BR": "ID do servidor de origem (vazio = BankCoin central)"
        })
        .setRequired(false)
    )
    .addStringOption(o =>
      o.setName("coin2")
        .setDescription("Name of the target server currency (empty = central)")
        .setDescriptionLocalizations({
          "pt-BR": "Nome da moeda do servidor de destino (vazio = central)"
        })
        .setRequired(false)
    ),

  async execute(interaction): Promise<void> {
    const lang        = await getUserLang(interaction.user.id);
    const name1 = interaction.options.getString("coin1") ?? null;
    const name2   = interaction.options.getString("coin2")   ?? null;
    const exchange = t("command.exchange", lang);

    if (name1 === null && name2 === null) {
      await interaction.reply({
        embeds:    [new ErrorEmbed(exchange.non_of_them, lang)],
        ephemeral: true
      });
      return;
    }

    const currencies = await db.select().from(serverCurrencies);

    const fromCurrency = name1 !== null
      ? currencies.find(c => c.name === name1)
      : null;
    const toCurrency   = name2 !== null
      ? currencies.find(c => c.name === name2)
      : null;

    if (!fromCurrency && !toCurrency) {
      await interaction.reply({
      embeds: [new ErrorEmbed(exchange.error.not_found, lang)],
      ephemeral: true
    });
    return;
  }

    const fromName = fromCurrency?.name ?? CENTRAL_CURRENCY.name;
    const toName   = toCurrency?.name   ?? CENTRAL_CURRENCY.name;
    const fromGuildId = fromCurrency?.guildId ?? null;
    const toGuildId   = toCurrency?.guildId   ?? null;
    const fromSym  = fromCurrency?.symbol ?? CENTRAL_CURRENCY.symbol;
    const toSym    = toCurrency?.symbol   ?? CENTRAL_CURRENCY.symbol;

    const rate = await computeAutoRate(fromGuildId, toGuildId);

    // Record snapshot
    await recordRate(fromGuildId, toGuildId, rate);

    const embed = new EmbedStructure({ color: "#0018A8", lang })
      .setTitle(`💱 ${exchange.exchange_rate}`)
      .addFields(
        { name: exchange.from, value: `**${fromName}** (${fromSym})`, inline: true },
        { name: "→",                      value: "\u200b",                        inline: true },
        { name: exchange.to,   value: `**${toName}** (${toSym})`,     inline: true },
        {
          name:  exchange.rate,
          value: `\`1 ${fromSym} = ${rate.toFixed(6)} ${toSym}\``,
          inline: false
        },
        {
          name:  exchange.note.title,
          value: exchange.note.content,
          inline: false
        }
      );

    await interaction.reply({ embeds: [embed] });
  }
} satisfies Command;
