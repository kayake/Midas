import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  type ButtonInteraction
} from "discord.js";
import { eq } from "drizzle-orm";

import { db }                  from "../../db/client";
import { guilds }              from "../../db/schema/index";
import { getUserPlan }         from "../../modules/subscription/subscription.service";
import { getPlan }             from "../../shared/plans";
import { buildProjection }     from "../../modules/leveling/xp.config";
import { renderXPProjection }  from "../../modules/leveling/xp.render";
import { EmbedStructure, ErrorEmbed } from "../../shared/EmbedStructure";
import { getUserLang, t }      from "../../i18n/index";

import type { Command } from "../../shared/types";
import type { XPAlgorithm } from "../../modules/leveling/xp.config";

export default {
  data: new SlashCommandBuilder()
    .setName("xp-config")
    .setDescription("Configure the XP algorithm for this server (requires Deutsche+)")
    .setDescriptionLocalizations({
      "pt-BR": "Configure o algoritmo de XP para este servidor"
    })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addNumberOption(o =>
      o.setName("base").setDescription("Base XP (default: 100)").setDescriptionLocalizations({
        "pt-BR": "Base de XP (padrão: 100)"
      }).setRequired(true)
    )
    .addNumberOption(o =>
      o.setName("exponent").setDescription("Exponent (default: 1.5)").setDescriptionLocalizations({
        "pt-BR": "Expoente (padrão: 1.5)"
      }).setRequired(true)
    )
    .addNumberOption(o =>
      o.setName("multiplier").setDescription("Multiplier (default: 1)").setDescriptionLocalizations({
        "pt-BR": "Multiplicador (padrão: 1)"
      }).setRequired(true)
    ),

  async execute(interaction): Promise<void> {
    const lang    = await getUserLang(interaction.user.id);
    const guildId = interaction.guildId!;
    const xp_config = t("command.xp-config", lang)

    const [guildRow] = await db.select().from(guilds).where(eq(guilds.id, guildId));
    const ownerId    = guildRow?.ownerId ?? interaction.guild!.ownerId;
    const planId     = await getUserPlan(ownerId);
    const plan       = getPlan(planId);

    if (!plan.canSetXPAlgorithm) {
      await interaction.reply({
        embeds:    [new ErrorEmbed(t("plan.required", lang), lang)],
        ephemeral: true
      });
      return;
    }

    const base       = interaction.options.getNumber("base", true);
    const exponent   = interaction.options.getNumber("exponent", true);
    const multiplier = interaction.options.getNumber("multiplier", true);

    const algo: XPAlgorithm = { base, exponent, multiplier };

    // Build projection for levels 1-20
    const projection = buildProjection(20, algo);

    const projectionText = projection
      .slice(0, 10)
      .map(p => `Level ${p.level} → **${p.totalXP.toLocaleString()} XP total**`)
      .join("\n");

    // Render graph
    const graphBuffer = renderXPProjection(20, algo);
    const graphAttachment = new AttachmentBuilder(graphBuffer, { name: "xp-projection.png" });

    const embed = new EmbedStructure({ color: "#0018A8", lang })
      .setTitle(xp_config.title)
      .setImage("attachment://xp-projection.png")
      .addFields(
        { name: xp_config.settings, value: `Base: \`${base}\` |${xp_config.exponent}: \`${exponent}\` | ${xp_config.multiplier}: \`${multiplier}\``, inline: false },
        { name: xp_config.simulation, value: projectionText, inline: false },
        { name: xp_config.note.name, value: xp_config.note.value, inline: false }
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("xpconfig_confirm")
        .setLabel(xp_config.buttons.confirm)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("xpconfig_cancel")
        .setLabel(xp_config.buttons.rejection)
        .setStyle(ButtonStyle.Danger)
    );

    const reply = await interaction.reply({
      embeds:     [embed],
      files:      [graphAttachment],
      components: [row],
      ephemeral:  true,
      fetchReply: true,
    });

    const collector = reply.createMessageComponentCollector({
      filter: (i): i is ButtonInteraction => i.user.id === interaction.user.id,
      time:   30_000,
      max:    1
    });

    collector.on("collect", async (btn: ButtonInteraction) => {
      if (btn.customId === "xpconfig_confirm") {
        await db
          .update(guilds)
          .set({ xpAlgorithm: algo })
          .where(eq(guilds.id, guildId));

        await btn.update({
          embeds:     [new EmbedStructure({ color: "#57F287", lang }).setDescription(xp_config.output.confirm)],
          components: []
        });
      } else {
        await btn.update({ content: xp_config.output.canceled, embeds: [], components: [] });
      }
    });
  }
} satisfies Command;
