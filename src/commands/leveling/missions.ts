import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  ComponentType,
  Attachment,
  AttachmentBuilder
} from "discord.js";
import { and, eq, name }  from "drizzle-orm";

import { getAssignedMissions, claimMissionReward } from "../../modules/missions/mission.service";
import { getUserPlan }         from "../../modules/subscription/subscription.service";
import { getPlan }             from "../../shared/plans";
import { EmbedStructure, ErrorEmbed, SuccessEmbed } from "../../shared/EmbedStructure";
import { getUserLang, t }      from "../../i18n/index";
import {
  getMissionExtraSlots,
  addMissionExtraSlots,
  getMissionShownSlots
} from "../../db/redis";
import { db }                  from "../../db/client";
import { guildMembers, serverCurrencies, users }        from "../../db/schema/index";

import type { Command }  from "../../shared/types";
import type { Mission }  from "../../modules/missions/mission.types";
import { renderMissionsGrid } from "../../modules/missions/mission.render";

// Base slots every user gets regardless of plan
const BASE_MISSION_SLOTS = 3;

const TYPE_EMOJI: Record<string, string> = {
  send_messages: "💬",
  voice_minutes: "🎙️",
  buy_item:      "🛒",
  gain_xp:       "⭐",
  reach_level:   "🎯"
};

const RARITY_COLORS: Record<string, string> = {
  hsbc:     "⬜",
  barclays: "🟦",
  deutsche: "🟪",
  ubs:      "🟨"
};

function buildMissionLine(
  mission:   Mission,
  progress:  number,
  completed: boolean,
  claimed:   boolean,
  lang:      string,
  serverCurrency?: { symbol: string; name: string }
): string {
  const emoji    = TYPE_EMOJI[mission.type] ?? "📋";
  const planIcon = RARITY_COLORS[mission.requiredPlan] ?? "⬜";
  const pct      = Math.min(100, Math.floor((progress / mission.target) * 100));
  const bar      = buildMiniBar(pct);

  const desc = lang === "en" ? mission.descriptionEn : mission.description;

  const statusIcon = claimed    ? "✅"
                   : completed  ? "🎁"
                   :              `${bar} ${pct}%`;

  const rewards: string[] = [];
  if (mission.xpReward > 0)   rewards.push(`⭐ ${mission.xpReward} XP`);
  if (mission.coinReward > 0 && serverCurrency) rewards.push(`${serverCurrency.symbol ?? "🪙"} ${mission.coinReward}`);
  if (mission.itemRewardId !== null) rewards.push("🎖️ Badge");

  return [
    `${planIcon} ${emoji} **${desc}**`,
    `↳ ${statusIcon}  •  ${progress}/${mission.target}  •  ${rewards.join(" ")}`,
    `↳ \`ID: ${mission.id}\``
  ].join("\n");
}

function buildMiniBar(pct: number): string {
  const filled = Math.round(pct / 20); // 5 chars
  return `[${"█".repeat(filled)}${"░".repeat(5 - filled)}]`;
}

export default {
  data: new SlashCommandBuilder()
    .setName("missions")
    .setDescription("View and manage your daily missions")
    .setDescriptionLocalizations({
      "pt-BR": "Veja e gerencie suas missões diárias"
    })
    .addSubcommand(s =>
      s.setName("view").setDescription("View your daily missions").setDescriptionLocalizations({
        "pt-BR": "Veja suas missões diárias"
      })
    )
    .addSubcommand(s =>
      s.setName("claim")
        .setDescription("Claim reward for a completed mission")
        .addIntegerOption(o =>
          o.setName("id").setDescription("Mission ID").setDescriptionLocalizations({
            "pt-BR": "ID da missão"
          }).setRequired(true)
        )
    ),

  async execute(interaction): Promise<void> {
    const lang    = await getUserLang(interaction.user.id);
    const userId  = interaction.user.id;
    const guildId = interaction.guildId!;
    const sub     = interaction.options.getSubcommand();

    const mission_cmd = t("command.missions", lang);
    
    // ── /missions claim ───────────────────────────────────────────────────────
    if (sub === "claim") {
      const missionId = interaction.options.getInteger("id", true);
      const result    = await claimMissionReward(userId, guildId, missionId);

      if (!result.success) {
        await interaction.reply({
          embeds:    [new ErrorEmbed(mission_cmd[result.reason ?? "error.generic"] ?? "Some error occurred", lang)],
          ephemeral: true
        });
        return;
      }

      await interaction.reply({
        embeds: [new SuccessEmbed(mission_cmd.completed.replace("{id}", missionId.toString()), lang)]
      });
      return;
    }
    
    // ── /missions view ────────────────────────────────────────────────────────
    await interaction.deferReply();
    
    const planId     = await getUserPlan(userId);
    const plan       = getPlan(planId);
    const baseSlots  = BASE_MISSION_SLOTS + plan.missionSlotsBonus;
    const shownSlots = await getMissionShownSlots(userId, baseSlots);
    
    const allMissions = await getAssignedMissions(userId, guildId);
    
    const [serverCurrency] = await db
    .select({ symbol: serverCurrencies.symbol, name: serverCurrencies.name })
    .from(serverCurrencies)
    .where(eq(serverCurrencies.guildId, guildId))
    .limit(1);
    // Only show up to shownSlots
    const visible    = allMissions.slice(0, shownSlots);
    const hasMore    = allMissions.length > shownSlots;
    
    const missionCanvas = await renderMissionsGrid(visible.map(m => ({
      mission: m.mission,
      progress: m.progress,
      completed: m.completed,
      claimed: false
    })), lang, serverCurrency);

    const attachment = new AttachmentBuilder(missionCanvas, { name: "missions.png" });
    // Build embed
    const lines = visible.map(({ mission, progress, completed }) => {
      // Check if already claimed — claimedAt not null
      const claimed = completed && progress >= mission.target;
      return buildMissionLine(mission, progress, completed, false, lang, serverCurrency);
    });


    const extraSlots = await getMissionExtraSlots(userId);
    const packCost   = plan.extraMissionPackCost;

    const embed = new EmbedStructure({ color: plan.color, lang })
      .setTitle(mission_cmd.how_to_claim)
      .setDescription(
        mission_cmd.description
      )
      .setFooter({
        text: `BankBot • ${plan.name} ${plan.label} — ${mission_cmd.refresh_at_midnight}`
      })
      .setImage("attachment://missions.png");

    // ── Buttons ───────────────────────────────────────────────────────────────
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    // Claim buttons for completed missions
    const completedUnclaimed = visible.filter(m => m.completed);
    if (completedUnclaimed.length > 0) {
      const claimRow = new ActionRowBuilder<ButtonBuilder>();
      for (const { mission } of completedUnclaimed.slice(0, 5)) {
        claimRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`mission_claim_${mission.id}`)
            .setLabel(mission_cmd.claim.replace("{id}", mission.id.toString()))
            .setStyle(ButtonStyle.Success)
          );
      }
      rows.push(claimRow);
    }
    
    // Buy extra missions pack button (grey, always shown if there are hidden missions)
    if (hasMore || allMissions.length < shownSlots && serverCurrency) {
      const extraRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`mission_buymore_${userId}`)
          .setLabel(mission_cmd.button.buymore)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(false)
      );
      rows.push(extraRow);
    }

    const reply = await interaction.editReply({
      embeds:     [embed],
      components: rows,
      files:      [attachment]
    });

    // ── Collector for buttons ─────────────────────────────────────────────────
    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter:        (i): i is ButtonInteraction => i.user.id === userId,
      time:          120_000  // 2 min
    });

    collector.on("collect", async (btn: ButtonInteraction) => {
      await btn.deferUpdate();

      // Claim button
      if (btn.customId.startsWith("mission_claim_")) {
        const mId   = parseInt(btn.customId.replace("mission_claim_", ""));
        const result = await claimMissionReward(userId, guildId, mId);

        if (!result.success) {
          await btn.followUp({
            embeds:    [new ErrorEmbed(mission_cmd[result.reason ?? "error.generic"] ?? "Some error occurred", lang)],
            ephemeral: true
          });
          return;
        }

        await btn.followUp({
          embeds:    [new SuccessEmbed(t("mission.complete", lang), lang)],
          ephemeral: true
        });
      }

      // Buy extra pack button
      if (btn.customId.startsWith("mission_buymore_")) {
        // Check coins
        const [member] = await db
          .select({ serverCoins: guildMembers.serverCoins })
          .from(guildMembers)
          .where(eq(guildMembers.userId, userId));

        const coins = member?.serverCoins ?? 0;

        if (coins < packCost) {
          await btn.followUp({
            embeds:    [new ErrorEmbed(mission_cmd.unsufficient_coins.replace("{coins}", packCost.toString()).replace("{currency}", serverCurrency?.symbol ?? "🪙"), lang)],
            ephemeral: true
          });
          return;
        }

        // Deduct coins
        await db
          .update(guildMembers)
          .set({ serverCoins: coins - packCost })
          .where(eq(guildMembers.userId, userId));

        // Add 3 extra slots
        await addMissionExtraSlots(userId, 3);

        // Rebuild updated view
        const newShown    = await getMissionShownSlots(userId, baseSlots);
        const newMissions = await getAssignedMissions(userId, guildId);
        const newVisible  = newMissions.slice(0, newShown);
        const newHasMore  = newMissions.length > newShown;
        const newExtra    = await getMissionExtraSlots(userId);

        const newLines = newVisible.map(({ mission, progress, completed }) =>
          buildMissionLine(mission, progress, completed, false, lang)
        );


        const updatedEmbed = new EmbedStructure({ color: plan.color, lang })
          .setTitle(mission_cmd.title)
          .setDescription(newLines.length > 0 ? newLines.join("\n\n") : t("mission.none", lang))
          .addFields(
            {
              name:  "📊 Slots",
              value: mission_cmd.slots.replace("{base}", baseSlots.toString()).replace("{extra}", extraSlots.toString()).replace("{total}", (baseSlots + extraSlots).toString()),
              inline: false
            },
            {
              name:   mission_cmd.how_to_claim,
              value:  mission_cmd.help,
              inline: false
            }
          )
          .setFooter({ text: `BankBot • ${plan.name} ${plan.label} — ${mission_cmd.refresh_at_midnight}` })
          .setImage("attachment://missions.png");
        // Rebuild buttons
        const newRows: ActionRowBuilder<ButtonBuilder>[] = [];

        const newCompleted = newVisible.filter(m => m.completed);
        if (newCompleted.length > 0) {
          const claimRow = new ActionRowBuilder<ButtonBuilder>();
          for (const { mission } of newCompleted.slice(0, 5)) {
            claimRow.addComponents(
              new ButtonBuilder()
                .setCustomId(`mission_claim_${mission.id}`)
                .setLabel(mission_cmd.button.claim.replace("{id}", mission.id.toString()))
                .setStyle(ButtonStyle.Success)
            );
          }
          newRows.push(claimRow);
        }

        if (newHasMore) {
          newRows.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`mission_buymore_${userId}`)
                .setLabel(mission_cmd.button.extra.replace("{cost}", `${packCost} ${serverCurrency?.symbol ?? "🪙"}`))
                .setStyle(ButtonStyle.Secondary)
            )
          );
        } else {
          // Disable button — no more hidden missions
          newRows.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`mission_buymore_${userId}`)
                .setLabel(mission_cmd.button.buymore)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
            )
          );
        }

        await btn.editReply({ embeds: [updatedEmbed], components: newRows });

        await btn.followUp({
          embeds: [new SuccessEmbed(mission_cmd.button.unloked_missions.replace("{count}", "3").replace("{coins}", `${packCost} ${serverCurrency?.symbol ?? "🪙"}`), lang)],
          ephemeral: true
        });
      }
    });

    collector.on("end", async () => {
      try {
        // Disable all buttons after timeout
        const disabledRows = rows.map(row => {
          const newRow = new ActionRowBuilder<ButtonBuilder>();
          row.components.forEach(btn => {
            newRow.addComponents(
              ButtonBuilder.from(btn.toJSON()).setDisabled(true)
            );
          });
          return newRow;
        });
        await interaction.editReply({ components: disabledRows });
      } catch { /* Message may have been deleted */ }
    });
  }
} satisfies Command;
