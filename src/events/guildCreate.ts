import type { Guild }    from "discord.js";
import type { BotEvent } from "../shared/types";

import { db }    from "../db/client";
import { guilds } from "../db/schema/index";

export default {
  name: "guildCreate",
  async execute(...args: unknown[]): Promise<void> {
    const guild = args[0] as Guild;

    await db
      .insert(guilds)
      .values({ id: guild.id, ownerId: guild.ownerId })
      .onConflictDoNothing();

    console.log(`[Bot] Joined guild: ${guild.name} (${guild.id})`);
  }
} satisfies BotEvent;
