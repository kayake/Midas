import { SlashCommandBuilder } from "discord.js";
import { and, eq, gte, count } from "drizzle-orm";
import { sql }                 from "drizzle-orm";

import { hasDailyClaimed, setDailyClaimed, lbSetGlobal, lbRankGlobal } from "../../db/redis";
import { EmbedStructure, ErrorEmbed }       from "../../shared/EmbedStructure";
import { getUserLang, t }                   from "../../i18n/index";
import { db }                               from "../../db/client";
import { xpLog, users }                     from "../../db/schema/index";
import { getMultiplier }                    from "../../modules/subscription/subscription.service";

import type { Command } from "../../shared/types";

const DAILY_COINS_MIN = 600;
const DAILY_COINS_MAX = 2100;
const ACTIVITY_SCALE  = 50;   // messages needed for ~63% of bonus

function calcDailyCoins(messagesToday: number): number {
  const bonus  = (DAILY_COINS_MAX - DAILY_COINS_MIN) * (1 - Math.exp(-messagesToday / ACTIVITY_SCALE));
  return Math.floor(DAILY_COINS_MIN + bonus);
}

// ─── Command ──────────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily coins")
    .setDescriptionLocalizations({
      "pt-BR": "Resgate suas coins diárias"
    }),

  async execute(interaction): Promise<void> {
    const userId  = interaction.user.id;
    const lang    = await getUserLang(userId);

    if (await hasDailyClaimed(userId)) {
      await interaction.reply({
        embeds:    [new ErrorEmbed(t("daily.claimed", lang), lang)],
        ephemeral: true
      });
      return;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [activityRow] = await db
      .select({ messages: count() })
      .from(xpLog)
      .where(
        and(
          eq(xpLog.userId, userId),
          eq(xpLog.source, "message"),
          gte(xpLog.createdAt, todayStart)
        )
      );

    const messagesToday = activityRow?.messages ?? 0;

    const baseCoins  = calcDailyCoins(messagesToday);

   
    const multiplier  = await getMultiplier(userId);
    const bonusPart   = baseCoins - DAILY_COINS_MIN;
    const finalCoins  = Math.floor(DAILY_COINS_MIN + bonusPart * multiplier);

    await setDailyClaimed(userId);

    await db
      .update(users)
      .set({ centralCoins: sql`${users.centralCoins} + ${finalCoins}` } as never)
      .where(eq(users.id, userId));

    
       const [updatedUser] = await db
      .select({ centralCoins: users.centralCoins })
      .from(users)
      .where(eq(users.id, userId));
    if (updatedUser !== undefined) {
      await lbSetGlobal(userId, updatedUser.centralCoins);
    }

    const multiplierStr = multiplier > 1 ? ` x${multiplier} (${t("plan", lang).toLowerCase()})` : "";
    const userRank = updatedUser ? await lbRankGlobal(userId) : null;
    const rankCondition = userRank !== null ? t("daily.rank_condition", lang).replace("{userRank}", userRank.toString()) : "";

    await interaction.reply({ content: t("daily.message", lang).replace("{coins}", `${finalCoins.toString()}${multiplierStr}`).replace("{rank_condition}", rankCondition) });
  }
} satisfies Command;