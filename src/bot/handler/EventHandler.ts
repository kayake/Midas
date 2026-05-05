import { readdirSync }  from "fs";
import { resolve }      from "path";
import type { Client }  from "discord.js";

import type { BotEvent } from "../../shared/types";

export class EventHandler {
  async load(client: Client): Promise<void> {
    const base  = resolve("src/events");
    const files = readdirSync(base).filter(f => f.endsWith(".ts") || f.endsWith(".js"));

    for (const file of files) {
      const mod   = await import(`../../events/${file.replace(/\.(ts|js)$/, "")}`) as { default: BotEvent };
      const event = mod.default;

      if (event.once === true) {
        client.once(event.name, (...args: unknown[]) => void event.execute(...args));
      } else {
        client.on(event.name, (...args: unknown[]) => void event.execute(...args));
      }

      console.log(`[Events] Loaded: ${event.name}`);
    }
  }
}
