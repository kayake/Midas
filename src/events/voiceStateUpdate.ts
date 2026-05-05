import type { VoiceState } from "discord.js";
import type { BotEvent }   from "../shared/types";

import { addXP }                    from "../modules/leveling/xp.service";
import { updateMissionProgress }    from "../modules/missions/mission.service";
import { db }                       from "../db/client";
import { guilds }                   from "../db/schema/index";

// Track voice join times in memory
const voiceSessions = new Map<string, number>(); // userId → joinTimestamp

export default {
  name: "voiceStateUpdate",
  async execute(...args: unknown[]): Promise<void> {
    const [oldState, newState] = args as [VoiceState, VoiceState];

    const userId  = newState.member?.user.id ?? oldState.member?.user.id;
    const guildId = newState.guild.id;

    if (userId === undefined) return;
    if (newState.member?.user.bot === true) return;

    // Ensure guild exists
    await db.insert(guilds).values({ id: guildId, ownerId: newState.guild.ownerId }).onConflictDoNothing();

    // User joined a voice channel
    if (oldState.channelId === null && newState.channelId !== null) {
      voiceSessions.set(`${userId}:${guildId}`, Date.now());
    }

    // User left or moved — calculate time
    if (oldState.channelId !== null && newState.channelId === null) {
      const key      = `${userId}:${guildId}`;
      const joinedAt = voiceSessions.get(key);
      if (joinedAt === undefined) return;

      voiceSessions.delete(key);

      const minutesSpent = Math.floor((Date.now() - joinedAt) / 60_000);
      if (minutesSpent < 1) return;

      // Award XP per minute in voice
      await addXP(userId, guildId, "voice", minutesSpent * 10);

      // Update voice mission progress
      await updateMissionProgress(userId, guildId, "voice_minutes", minutesSpent);
    }
  }
} satisfies BotEvent;
