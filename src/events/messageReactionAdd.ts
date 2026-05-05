import type { MessageReaction, User } from "discord.js";
import type { BotEvent } from "../shared/types";

import { updateMissionProgress } from "../modules/missions/mission.service";
import { db } from "../db/client";
import { guilds } from "../db/schema/index";

export default {
  name: "messageReactionAdd",
  async execute(...args: unknown[]): Promise<void> {
    const [reaction, user] = args as [MessageReaction, User];

    if (user.bot) return;
    if (reaction.message.guild === null) return;

    const userId = user.id;
    const guildId = reaction.message.guild.id;

    // Ensure guild exists
    await db.insert(guilds).values({ id: guildId, ownerId: reaction.message.guild.ownerId }).onConflictDoNothing();

    // Update mission progress for react_message missions
    // Custom emojis from the server count towards this mission
    if (reaction.emoji.id !== null) {
      await updateMissionProgress(userId, guildId, "react_message", 1);
    }
  }
} satisfies BotEvent;
