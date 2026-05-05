// src/bot/handler/CommandHandler.ts
import { REST, Routes } from "discord.js";
import { readdirSync }  from "fs";
import { resolve }      from "path";
import type { Client }  from "discord.js";

import type { Command } from "../../shared/types";

export class CommandHandler {
  private commands = new Map<string, Command>();
  private rest     = new REST().setToken(process.env.DISCORD_TOKEN!);

  async load(client: Client): Promise<void> {
    const base  = resolve("src/commands");
    const dirs  = readdirSync(base);
    const jsons = [];

    for (const dir of dirs) {
      const files = readdirSync(`${base}/${dir}`).filter(f =>
        f.endsWith(".ts") || f.endsWith(".js")
      );
      for (const file of files) {
        const mod = await import(`../../commands/${dir}/${file.replace(/\.(ts|js)$/, "")}`) as { default: Command };
        const cmd = mod.default;
        this.commands.set(cmd.data.name, cmd);
        jsons.push(cmd.data.toJSON());
        client.emit("debug", `[Commands] Loaded: ${cmd.data.name}`);
      }
    }

    await this.rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: jsons }
    );

    console.log(`[Commands] ${jsons.length} commands registered.`);
  }

  get(name: string): Command | undefined {
    return this.commands.get(name);
  }

  all(): Command[] {
    return [...this.commands.values()];
  }
}
