// src/events/ready.ts
import type { Client } from "discord.js";
import type { BotEvent } from "../shared/types";

export default {
  name: "clientReady",
  once: true,
  async execute(...args: unknown[]): Promise<void> {
    const client = args[0] as Client;
    console.log(`[Bot] Logged in as ${client.user?.tag ?? "Unknown"}`);
  }
} satisfies BotEvent;
