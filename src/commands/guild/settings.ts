import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, type BaseGuildTextChannel } from "discord.js";
import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { guilds } from "../../db/schema/index";
import { getUserLang, t } from "../../i18n/index";
import { SuccessEmbed, ErrorEmbed, EmbedStructure, WarnEmbed } from "../../shared/EmbedStructure";
import type { Command } from "../../shared/types";
import { getPlan } from "../../shared/plans";
import { getUserPlan } from "../../modules/subscription/subscription.service";
import { createCurrency } from "../../modules/economy/currency.service";

export default {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("Configure server settings")
    .setDescriptionLocalizations({
      "pt-BR": "Configure as configurações do servidor"
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s =>
      s.setName("mission-notification-channel")
        .setDescription("Set the mission notification channel")
        .setDescriptionLocalizations({ "pt-BR": "Defina o canal de notificações" })
        .addChannelOption(o =>
          o.setName("channel")
            .setDescription("Text channel for notifications")
            .setDescriptionLocalizations({ "pt-BR": "Canal de texto para notificações" })
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(s =>
      s.setName("xp-notification")
        .setDescription("Set notification channel and/or message")
        .setDescriptionLocalizations({ "pt-BR": "Remova o canal de notificações" })
        .addChannelOption(o =>
          o.setName("channel")
            .setDescription("Text channel for notifications")
            .setDescriptionLocalizations({ "pt-BR": "Canal de texto para notificações" })
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addStringOption(o =>
          o.setName("message")
            .setDescription("Message when level up")
            .setDescriptionLocalizations({
              "pt-BR": "Messagem de aviso ao subir de nível"
            })
            .setRequired(false)
        )
    )
    .addSubcommand(s =>
      s.setName("boost-config")
        .setDescription("Configure boost settings")
        .setDescriptionLocalizations({ "pt-BR": "Configure as configurações de boost" })
            .addBooleanOption(o =>
              o.setName("enabled").setDescription("Enable/disable booster bonus").setDescriptionLocalizations({
                "pt-BR": "Ativar/desativar bônus de boost"
              }).setRequired(true)
            )
            .addNumberOption(o =>
              o.setName("max_bonus").setDescription("Maximum multiplier for boosters").setDescriptionLocalizations({
                "pt-BR": "Multiplicador máximo para boosters"
              }).setRequired(false)
          )
    )
    .addSubcommand(s =>
      s.setName("currency-create")
        .setDescription("Create a custom currency for this server (requires Barclays+ plan)")
        .setDescriptionLocalizations({
          "pt-BR": "Cria uma moeda personalizada para este servidor (requer plano Barclays+)"
         })
         .addStringOption(o =>
        o.setName("name").setDescription("Currency name (e.g., Dollar)").setDescriptionLocalizations({
          "pt-BR": "Nome da moeda (ex: Dólar)"
        }).setRequired(true)
      )
      .addStringOption(o =>
        o.setName("symbol").setDescription("Currency symbol (e.g., $)").setDescriptionLocalizations({
          "pt-BR": "Símbolo da moeda (ex: $)"
        }).setRequired(true)
      )
      .addStringOption(o =>
        o.setName("image_url").setDescription("URL of the currency image").setDescriptionLocalizations({
          "pt-BR": "URL da imagem da moeda"
        }).setRequired(true)
      )
    )
    .addSubcommand(s=>
    s.setName("currency-edit")
      .setDescription("Edit the server currency settings")
      .setDescriptionLocalizations({
        "pt-BR": "Edita as configurações da moeda do servidor"
      })
    .addStringOption(s =>
      s.setName("emoji")
        .setDescription("Tries to create/recreate the currency emoji (requires Barclays+ plan)")
        .setDescriptionLocalizations({
          "pt-BR": "Tenta criar/recriar o emoji da moeda (requer plano Barclays+)"
        })
        .setRequired(false)
    )
  ),

  async execute(interaction): Promise<void> {
    const lang = await getUserLang(interaction.user.id);
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();
    const [guildRow] = await db.select().from(guilds).where(eq(guilds.id, guildId));
    const ownerId = interaction.guild?.ownerId
    if (!ownerId || !guildRow) {
      await interaction.reply({ embeds: [new ErrorEmbed("DataBaseError[GUILD_NOT_FOUND]: Guild Not Found. Please register")]})
      throw new Error("DataBaseError: GUILD_NOT_FOUND")
    }
    const plan = getPlan(await getUserPlan(ownerId));
    const settings = t("command.settings", lang)[sub]

    switch (sub) {
      case "xp-notification":
        const channel = interaction.options.getChannel("channel") as BaseGuildTextChannel | null;
        const m = interaction.options.getString("message", false)
        const channelId = channel?.id ?? null;
        const embeds_ = []
        const u: any = {}
        if (m) {
          u.xpNotificationMessage = m
          embeds_.push(new SuccessEmbed(settings.message.replace("{message}", m), lang))
        }
        if (channel) {
          u.xpNotificationChannelId = channelId
          embeds_.push(new SuccessEmbed((channelId ? settings.channel.set : settings.channel.remove).replace("{channel}", channel), lang))
        }
        await db.update(guilds).set(u).where(eq(guilds.id, guildId));
        
        await interaction.reply({ embeds: embeds_, ephemeral: true });
        break;

      case "boost-config":
        if (plan.boostBonusMax === 0) {
          await interaction.reply({ embeds: [new ErrorEmbed(settings.errors.plan_required, lang)], ephemeral: true });
          return;
        }
        const enabled = interaction.options.getBoolean("enabled", true);
        const maxBonus = Math.min(interaction.options.getNumber("max_bonus") ?? plan.boostBonusMax, plan.boostBonusMax);
        const boostMessage = enabled
          ? settings.enabled.replace("{bonus}", maxBonus)
          : settings.disabled;

          await db
            .update(guilds)
            .set({ boostBonusEnabled: enabled, boostBonusMax: maxBonus })
            .where(eq(guilds.id, guildId))
        
        await interaction.reply({ embeds: [new SuccessEmbed(boostMessage, lang)], ephemeral: true });
        break;

      case "currency-create":
        if (!plan.canCreateCurrency) {
          await interaction.reply({ embeds: [new ErrorEmbed(settings.errors.plan_required, lang)], ephemeral: true });
          return;
        }
        const name = interaction.options.getString("name", true);
        const symbol = interaction.options.getString("symbol", true);
        const imageUrl = interaction.options.getString("image_url", true);
        const { emojiCreated } = await createCurrency({ guildId, name, symbol, imageUrl }, interaction.guild!);
        const embed = new EmbedStructure({ color: "#57F287", lang })
          .setTitle(settings.embed.title)
          .addFields({ name: settings.embed.fields.name, value: name, inline: true }, { name: "Símbolo", value: symbol, inline: true })
          .setThumbnail(imageUrl);
        if (!emojiCreated) embed.setFooter({ text: settings.embed.no_created_emoji });
        await interaction.reply({ embeds: [embed] });
        break;

      case "currency-edit":
        if (!plan.canCreateCurrency) {
          await interaction.reply({ embeds: [new ErrorEmbed(t("plan.required", lang), lang)], ephemeral: true });
          return;
        }
        // Provide default values for name, symbol, and imageUrl in currency-edit
        const editName = "Placeholder";
        const editSymbol = "?";
        const editImageUrl = "https://via.placeholder.com/64";
        const e = await createCurrency(
          { guildId, name: editName, symbol: editSymbol, imageUrl: editImageUrl },
          interaction.guild!
        );

        
        const embeds = [new SuccessEmbed(settings.sucess, lang)]
        if (!e.emojiCreated) embeds.push(new WarnEmbed(settings.errros.emoji_not_created, lang))
        await interaction.reply({ embeds, ephemeral: true });
        break;

      default:
        await interaction.reply({ embeds: [new ErrorEmbed("Unknown subcommand.", lang)], ephemeral: true });
        break;
    };
  }
} satisfies Command;
