import type { GuildMember, PartialGuildMember } from "discord.js";
import { eq, and }                              from "drizzle-orm";

import { db }           from "../db/client";
import { guildMembers } from "../db/schema/index";

import type { BotEvent } from "../shared/types";

export default {
  name: "guildMemberRemove",
  async execute(...args: unknown[]): Promise<void> {
    const member = args[0] as GuildMember | PartialGuildMember;

    try {
      await db
        .delete(guildMembers)
        .where(
          and(
            eq(guildMembers.userId, member.id),
            eq(guildMembers.guildId, member.guild.id)
          )
        );

      console.log(`[GuildMemberRemove] Removed guildMember: ${member.id} from ${member.guild.id}`);
    } catch (err) {
      console.error(`[GuildMemberRemove] Failed to remove ${member.id}:`, err);
    }
  }
} satisfies BotEvent;