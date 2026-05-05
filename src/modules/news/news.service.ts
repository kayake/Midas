import { eq, isNull } from "drizzle-orm";
import type { Client } from "discord.js";

import { db } from "../../db/client";
import { news, guilds } from "../../db/schema/index";

let _client: Client | null = null;

export function setNewsClient(client: Client): void {
  _client = client;
}

export async function addNews(
  options:   Record<string, unknown>,
  createdBy: string
): Promise<void> {
  await db.insert(news).values({ options, createdBy });
}

export async function broadcastPendingNews(): Promise<void> {
  if (_client === null) return;

  const pending = await db
    .select()
    .from(news)
    .where(isNull(news.sentAt));

  if (pending.length === 0) return;

  const optInGuilds = await db
    .select({ id: guilds.id, logChannelId: guilds.logChannelId })
    .from(guilds)
    .where(eq(guilds.newsOptIn, true));

  for (const item of pending) {
    for (const guild of optInGuilds) {
      if (guild.logChannelId === null) continue;

      try {
        const discordGuild = await _client.guilds.fetch(guild.id);
        const channel      = await discordGuild.channels.fetch(guild.logChannelId);
        if (channel === null || !channel.isTextBased()) continue;

        await channel.send(item.options as Parameters<typeof channel.send>[0]);
      } catch {
        // Skip unreachable guilds
      }
    }

    await db.update(news).set({ sentAt: new Date() }).where(eq(news.id, item.id));
  }
}
