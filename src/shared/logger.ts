import { db } from "../db/client";
import { commandLog, commandMetrics } from "../db/schema/index";
import { eq, sql } from "drizzle-orm";
import type { Client } from "discord.js";
import { EmbedStructure } from "../shared/EmbedStructure";

interface LogCommandOptions {
  userId:   string;
  guildId:  string | null;
  command:  string;
  args:     Record<string, unknown>;
  response: string;
  success:  boolean;
}

let _client: Client | null = null;

export function setClient(client: Client): void {
  _client = client;
}

export async function logCommand(opts: LogCommandOptions): Promise<void> {
  await Promise.all([
    db.insert(commandLog).values(opts),
    db
      .insert(commandMetrics)
      .values({ command: opts.command, useCount: 1, lastUsed: new Date() })
      .onConflictDoUpdate({
        target: commandMetrics.command,
        set: {
          useCount: sql`${commandMetrics.useCount} + 1`,
          lastUsed: new Date()
        }
      })
  ]);

  if (_client === null || opts.guildId === null) return;

  try {
    const guild = await _client.guilds.fetch(opts.guildId);
    const { guilds } = await import("../db/schema/index.js");
    const [guildData] = await db
      .select({ logChannelId: guilds.logChannelId })
      .from(guilds)
      .where(eq(guilds.id, opts.guildId));

    if (guildData?.logChannelId === null || guildData?.logChannelId === undefined) return;

    const channel = await guild.channels.fetch(guildData.logChannelId);
    if (channel === null || !channel.isTextBased()) return;

    const embed = new EmbedStructure({ color: opts.success ? "#57F287" : "#ED4245" })
      .setTitle(`📋 Command Log — /${opts.command}`)
      .addFields(
        { name: "User",    value: `<@${opts.userId}>`,          inline: true },
        { name: "Command", value: `\`/${opts.command}\``,       inline: true },
        { name: "Success", value: opts.success ? "✅" : "❌",   inline: true },
        { name: "Args",    value: `\`\`\`json\n${JSON.stringify(opts.args, null, 2)}\n\`\`\`` },
        { name: "Response", value: opts.response.slice(0, 1024) }
      );

    await channel.send({ embeds: [embed] });
  } catch {
    // silently fail — log channel may not exist
  }
}
