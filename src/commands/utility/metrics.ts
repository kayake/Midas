import {
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  type ButtonInteraction
} from "discord.js";

import { EmbedStructure }        from "../../shared/EmbedStructure";
import { getUserLang, t }           from "../../i18n/index";
import { getCpuUsage, getMemoryUsage, getTopCommands, getLeastUsedCommands } from "../../modules/metrics/metrics.service";
import { renderCommandsChart }   from "../../modules/metrics/metrics.render";

import type { Command } from "../../shared/types";

export default {
  data: new SlashCommandBuilder()
    .setName("metrics")
    .setDescription("View system metrics and command usage statistics")
    .setDescriptionLocalizations({
      "pt-BR": "Veja as métricas do sistema e estatísticas de uso dos comandos"
    }),

  async execute(interaction): Promise<void> {
    const lang = await getUserLang(interaction.user.id);
    const metrics = t("command.metrics", lang) as Record<string, any>;

    await interaction.deferReply();

    let showTop = true; // toggle between top/least used

    const buildPage = async (top: boolean): Promise<{
      embed: import("discord.js").EmbedBuilder;
      attachment: AttachmentBuilder;
    }> => {
      const cpu    = getCpuUsage();
      const mem    = getMemoryUsage();
      const cmds   = top ? await getTopCommands(10) : await getLeastUsedCommands(10);

      const chartBuf   = renderCommandsChart(cmds);
      const attachment = new AttachmentBuilder(chartBuf, { name: "commands.png" });

      const freeRam = mem.total - mem.used;

      const embed = new EmbedStructure({ color: "#2C2F33", lang })
        .setTitle(metrics.title)
        .addFields(
          {
            name:  metrics.cpu_usage,
            value: `\`${cpu}%\``,
            inline: true
          },
          {
            name:  metrics.memory_usage,
            value: `\`${mem.used} MB / ${mem.total} MB\` (${mem.percentage}%)`,
            inline: true
          },
          {
            name:  metrics.uptime,
            value: `\`${Math.round(process.uptime())} seconds\``,
            inline: true
          },
          {
            name:  metrics.node_heap,
            value: `\`${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB usado\``,
            inline: true
          },
          {
            name:  metrics.cores,
            value: `\`${require("os").cpus().length}\``,
            inline: true
          },
          {
            name: "📦 Node.js",
            value: `\`${process.version}\``,
            inline: true
          }
        )
        .setImage("attachment://commands.png")
        .setFooter({
          text: metrics.footer[String(top)],
        });

      return { embed, attachment };
    };

    const buildRow = (top: boolean): ActionRowBuilder<ButtonBuilder> =>
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("metrics_top")
          .setLabel(metrics.label_top)
          .setStyle(top ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("metrics_least")
          .setLabel(metrics.label_least)
          .setStyle(!top ? ButtonStyle.Primary : ButtonStyle.Secondary)
      );

    const { embed, attachment } = await buildPage(showTop);

    const reply = await interaction.editReply({
      embeds:     [embed],
      files:      [attachment],
      components: [buildRow(showTop)]
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter:        (i): i is ButtonInteraction => i.user.id === interaction.user.id,
      time:          60_000
    });

    collector.on("collect", async (btn: ButtonInteraction) => {
      await btn.deferUpdate();
      showTop = btn.customId === "metrics_top";
      const { embed: newEmbed, attachment: newAtt } = await buildPage(showTop);
      await btn.editReply({
        embeds:     [newEmbed],
        files:      [newAtt],
        components: [buildRow(showTop)]
      });
    });

    collector.on("end", async () => {
      try { await interaction.editReply({ components: [] }); } catch { /* deleted */ }
    });
  }
} satisfies Command;