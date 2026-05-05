import { ChannelType, type Message, type TextBasedChannel } from "discord.js";

import { addXP } from "../modules/leveling/xp.service";
import { updateMissionProgress } from "../modules/missions/mission.service";
import { validateMessageAgainstMissions } from "../modules/missions/mission.validator";
import { validateMessageForXP } from "../modules/leveling/xp.validation";
import { t, getUserLang } from "../i18n/index";
import { db } from "../db/client";
import { guilds } from "../db/schema/index";

import type { BotEvent } from "../shared/types";

export default {
  name: "messageCreate",
  async execute(...args: unknown[]): Promise<void> {
    const message = args[0] as Message;
    if (message.author.bot || message.guild === null) return;

    const userId  = message.author.id;
    const guildId = message.guild.id;

    // Ensure guild exists
    await db.insert(guilds).values({ id: guildId, ownerId: message.guild.ownerId }).onConflictDoNothing();

    // Validate message for XP (cooldown, min chars, repetition)
    const xpValidation = await validateMessageForXP(userId, guildId, message.content);
    if (!xpValidation.valid) {
      // Message doesn't qualify for XP, but might still count for other missions
      const specificMissions = await validateMessageAgainstMissions(message.content, userId, guildId);
      for (const missionId of specificMissions) {
        await updateMissionProgress(userId, guildId, "send_specific_message", 1);
      }
      return;
    }

    // XP
    const result = await addXP(userId, guildId, "message");
    if (result?.leveledUp === true && result.newLevel !== null) {
      const lang = await getUserLang(userId);
      if (message.channel.isTextBased() && message.channel.type == ChannelType.GuildText) {
        await message.channel.send(
          `🎉 <@${userId}> ${t("level.up", lang)} **${result.newLevel}**!`
        );
      }

      // Assign level-up roles
      if (result.roleIds.length > 0 && message.member !== null) {
        for (const roleId of result.roleIds) {
          try {
            await message.member.roles.add(roleId);
          } catch { /* Role may not exist */ }
        }
      }
    }

    // Mission progress
    await updateMissionProgress(userId, guildId, "send_messages", 1);
    
    // Check for emoji in message
    const emojiRegex = /<a?:\w+:\d+>|[^\w\s]/gu;
    const emojis = message.content.match(emojiRegex);
    if (emojis !== null && emojis.length > 0) {
      await updateMissionProgress(userId, guildId, "send_emoji", 1);
    }

    // Check for specific messages dynamically
    const specificMissions = await validateMessageAgainstMissions(message.content, userId, guildId);
    for (const missionId of specificMissions) {
      await updateMissionProgress(userId, guildId, "send_specific_message", 1);
    }
  }
} satisfies BotEvent;
