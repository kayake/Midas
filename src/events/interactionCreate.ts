import { ChannelType, MessageFlags, type Interaction } from "discord.js";
import type { BotEvent }    from "../shared/types";
import type { CommandHandler } from "../bot/handler/CommandHandler";

import { logCommand }   from "../shared/logger";
import { getUserLang, t }  from "../i18n/index";
import { ErrorEmbed }   from "../shared/EmbedStructure";
import { db }           from "../db/client";
import { users }        from "../db/schema/index";
import { adsService } from "../modules/ads/ads.service";
import { eq }           from "drizzle-orm";
import { getPlan } from "../shared/plans";


export default {
  name: "interactionCreate",
  async execute(interaction: Interaction): Promise<void> {
    if (interaction.isChatInputCommand()) {
      const client   = interaction.client as typeof interaction.client & { commands: CommandHandler };
      const command  = client.commands.get(interaction.commandName);
      if (command === undefined) return;
    
      
      const userId = interaction.user.id;

      // Ensure user exists
      await db.insert(users).values({ id: userId }).onConflictDoNothing();

      const lang   = await getUserLang(userId);
      
      // Privacy gate
      const [user] = await db
      .select({ privacyAccepted: users.privacyAccepted })
      .from(users)
      .where(eq(users.id, userId));
      
      if (
        (user === undefined || !user.privacyAccepted) &&
        interaction.commandName !== "privacy" &&
        interaction.commandName !== "delete-data"
      ) {
        const privacy = t("command.privacy", lang);
        await interaction.reply({
          embeds: [new ErrorEmbed(privacy.missing_acceptance, lang)],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      
      const args: Record<string, unknown> = {};
      for (const option of interaction.options.data) {
        args[option.name] = option.value;
      }
      
      let responseText = "ok";
      let success      = true;
      
      try {
        await command.execute(interaction);
        const shouldSend = interaction.channel?.type === ChannelType.GuildText && adsService.shouldSendAd(interaction.guildId!);
        if (shouldSend && getPlan(interaction.guild?.ownerId ?? "")?.hasAd) {
          const ad = await adsService.sendAds();
          if (ad) {
            if (!interaction.replied && !interaction.deferred) {
              await interaction.reply(ad);
            } else {
              await interaction.followUp(ad);
            }
          }
        }
      } catch (err) {
        success      = false;
        responseText = err instanceof Error ? err.message : "Unknown error";
        console.error(err)
        if (err == "DataBaseError: GUILD_NOT_FOUND" && interaction.guild) {
          const { guilds } = await import("../db/schema/index.js");
          await db
                .insert(guilds)
                .values({ id: interaction.guild?.id, ownerId: interaction.guild.ownerId })
                .onConflictDoNothing()
          
          responseText = `[DataBaseError[GUILD_NOT_FOUND]]: The Guild ${interaction.guild.id} wasn't registered. Please use the command again.`
        }
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            embeds: [new ErrorEmbed(t("error", lang).replace("{error}", responseText), lang)],
            flags: MessageFlags.Ephemeral
          });
        }
      }

      await logCommand({
        userId,
        guildId:  interaction.guildId,
        command:  interaction.commandName,
        args,
        response: responseText,
        success
      });
    }

    if (interaction.isAutocomplete()) {
      const client  = interaction.client as typeof interaction.client & { commands: CommandHandler };
      const command = client.commands.get(interaction.commandName);
      if (command?.autocomplete !== undefined) {
        await command.autocomplete(interaction);
      }
    }

    // Button handler — privacy accept/decline
    if (interaction.isButton()) {
      const lang = await getUserLang(interaction.user.id);
      const privacy = t("command.privacy", lang);
      if (interaction.customId === "privacy_accept") {
        await db
          .insert(users)
          .values({ id: interaction.user.id, privacyAccepted: true, privacyAt: new Date() })
          .onConflictDoUpdate({
            target: users.id,
            set:    { privacyAccepted: true, privacyAt: new Date() }
          });
        await interaction.update({ content: privacy.accepted, embeds: [], components: [] });
      } else if (interaction.customId === "privacy_decline") {
        await interaction.update({ content: privacy.declined, embeds: [], components: [] });
      }
    }
  }
} satisfies BotEvent;
