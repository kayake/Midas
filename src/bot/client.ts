import "dotenv/config";

import { Client, GatewayIntentBits, Partials } from "discord.js";

import { CommandHandler } from "./handler/CommandHandler";
import { EventHandler }   from "./handler/EventHandler";
import { startStatusRotation } from "./status";
import { setClient }      from "../shared/logger";
import { setNewsClient }  from "../modules/news/news.service";
import { AdsService } from "../modules/ads/ads.service";

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel]
});

export async function startBot(): Promise<void> {
  const commandHandler = new CommandHandler();
  const eventHandler   = new EventHandler();

  await commandHandler.load(client);
  await eventHandler.load(client);

  // Inject client into services that need it
  setClient(client);
  setNewsClient(client);

  // Store command handler on client for use in events
  (client as typeof client & { commands: CommandHandler }).commands = commandHandler;

  await client.login(process.env.DISCORD_TOKEN);

  startStatusRotation(client);
}
