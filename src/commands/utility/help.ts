import { InteractionResponse, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../shared/types";
import { t } from "../../i18n";
import { getUserPlan } from "../../modules/subscription/subscription.service";
import { EmbedStructure } from "../../shared/EmbedStructure";
import { commands, docs_translations, privacy_policy, support_server, ToS } from "../../shared/constants";



export default {
    data: new SlashCommandBuilder()
        .setName("help")
        .setNameLocalizations({
            "pt-BR": "ajuda"
        })
        .setDescription("Show commands, ToS and Privacy Policy")
        .setDescriptionLocalizations({
            "pt-BR": "Mostra os comandos, Termos de Serviço e Política de Privacidade"
    }),
    async execute(interaction): Promise<void> {
        const lang = await getUserPlan(interaction.user.id)
        const help = t("command.help", lang)

        help.fields.forEach((i: { name: string, value: string, inline: string }) =>
            i.value = i.value.replace("{terms}", ToS)
                .replace("{help}", commands)
                .replace("{discord_server}", support_server)
                .replace("{pp}", privacy_policy)
                .replace("{base}", docs_translations)
        )

        const embed = new EmbedStructure()
            .setTitle(help.title)
            .setDescription(help.description)
            .setFields(help.fields)
            .setThumbnail(interaction.client.user.displayAvatarURL())
            

        interaction.reply({ embeds: [embed] })
    }
} satisfies Command