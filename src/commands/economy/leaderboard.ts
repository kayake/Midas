import {
  SlashCommandBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  type ButtonInteraction,
  type Client
} from "discord.js";

import {
  lbGetGlobal, lbGetServer, lbCountGlobal, lbCountServer
} from "../../db/redis";
import { db }                       from "../../db/client";
import { serverCurrencies, users }  from "../../db/schema/index";
import { eq }                       from "drizzle-orm";
import { renderLeaderboard }        from "../../modules/leveling/leaderboard.render";
import { ErrorEmbed }               from "../../shared/EmbedStructure";
import { getUserLang }              from "../../i18n/index";
import { CENTRAL_CURRENCY }         from "../../shared/constants";

import type { Command }             from "../../shared/types";
import type {
  LeaderboardEntry,
  LeaderboardMode,
  CoinType
} from "../../modules/leveling/leaderboard.render";

const PER_PAGE = 10;

// ─── Data fetchers (from Redis) ───────────────────────────────────────────────

async function fetchGlobal(page: number, viewerId: string): Promise<{
  entries: LeaderboardEntry[]; total: number
}> {
  const [rows, total] = await Promise.all([
    lbGetGlobal(page, PER_PAGE),
    lbCountGlobal()
  ]);

  // Fetch bio/backgroundId/profileColorId for each user from DB
  const entries: LeaderboardEntry[] = await Promise.all(
    rows.map(async (r, i) => {
      const [userRow] = await db
        .select({ bio: users.bio, backgroundId: users.backgroundId, profileColorId: users.profileColorId })
        .from(users)
        .where(eq(users.id, r.userId));

      return {
        rank:           (page - 1) * PER_PAGE + i + 1,
        userId:         r.userId,
        username:       r.userId,
        avatarUrl:      "",
        coins:          r.score,
        level:          1,
        isViewer:       r.userId === viewerId,
        bio:            userRow?.bio,
        backgroundId:   userRow?.backgroundId,
        profileColorId: userRow?.profileColorId,
        currencySymbol: CENTRAL_CURRENCY.symbol,
        currencyImgUrl: null
      } satisfies LeaderboardEntry;
    })
  );

  return { entries, total };
}

async function fetchLocalServer(guildId: string, page: number, viewerId: string): Promise<{
  entries: LeaderboardEntry[]; total: number; currency: typeof serverCurrencies.$inferSelect | null
}> {
  const [currency] = await db
    .select()
    .from(serverCurrencies)
    .where(eq(serverCurrencies.guildId, guildId));

  if (currency === undefined) return { entries: [], total: 0, currency: null };

  const [rows, total] = await Promise.all([
    lbGetServer(guildId, page, PER_PAGE),
    lbCountServer(guildId)
  ]);

  const entries: LeaderboardEntry[] = await Promise.all(
    rows.map(async (r, i) => {
      const [userRow] = await db
        .select({ bio: users.bio, backgroundId: users.backgroundId, profileColorId: users.profileColorId })
        .from(users)
        .where(eq(users.id, r.userId));

      return {
        rank:           (page - 1) * PER_PAGE + i + 1,
        userId:         r.userId,
        username:       r.userId,
        avatarUrl:      "",
        coins:          r.score,
        level:          1,
        isViewer:       r.userId === viewerId,
        bio:            userRow?.bio,
        backgroundId:   userRow?.backgroundId,
        profileColorId: userRow?.profileColorId,
        currencySymbol: currency.symbol,
        currencyImgUrl: currency.imageUrl
      } satisfies LeaderboardEntry;
    })
  );

  return { entries, total, currency };
}

// ─── Resolve Discord users ────────────────────────────────────────────────────

async function resolveUsers(client: Client, entries: LeaderboardEntry[]): Promise<LeaderboardEntry[]> {
  return Promise.all(entries.map(async e => {
    try {
      const user  = await client.users.fetch(e.userId);
      e.username  = user.username;
      e.avatarUrl = user.displayAvatarURL({ size: 64, extension: "png" });
    } catch {
      e.username  = `User ${e.userId.slice(0, 6)}`;
    }
    return e;
  }));
}

// ─── Build page ───────────────────────────────────────────────────────────────

interface BuildOpts {
  client: Client; guildId: string; guildName: string;
  viewerId: string; mode: LeaderboardMode; coinType: CoinType;
  page: number; lang: "pt" | "en";
}

async function buildPage(opts: BuildOpts): Promise<{
  buffer: Buffer; totalPages: number; hasCurrency: boolean;
  serverCoinImg: string | null;
}> {
  const { client, guildId, guildName, viewerId, mode, coinType, page, lang } = opts;

  let entries:       LeaderboardEntry[] = [];
  let total          = 0;
  let hasCurrency    = true;
  let serverCoinImg: string | null = null;

  if (mode === "global") {
    const r = await fetchGlobal(page, viewerId);
    entries = r.entries; total = r.total;
  } else {
    const r = await fetchLocalServer(guildId, page, viewerId);
    if (r.currency === null) { hasCurrency = false; }
    else { serverCoinImg = r.currency.imageUrl; entries = r.entries; total = r.total; }
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  if (entries.length > 0) entries = await resolveUsers(client, entries);

  const buffer = await renderLeaderboard(
    entries, mode, coinType, page, totalPages, guildName, lang, serverCoinImg
  );

  return { buffer, totalPages, hasCurrency, serverCoinImg };
}

// ─── Pagination buttons ───────────────────────────────────────────────────────

function buildButtons(p: number, total: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("lb_first").setEmoji("⏮️").setStyle(ButtonStyle.Secondary).setDisabled(p === 1),
    new ButtonBuilder().setCustomId("lb_prev").setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(p === 1),
    new ButtonBuilder().setCustomId("lb_indicator").setLabel(`${p} / ${total}`).setStyle(ButtonStyle.Primary).setDisabled(true),
    new ButtonBuilder().setCustomId("lb_next").setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(p >= total),
    new ButtonBuilder().setCustomId("lb_last").setEmoji("⏭️").setStyle(ButtonStyle.Secondary).setDisabled(p >= total)
  );
}

// ─── Command ──────────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Ranking de moedas")
    .addSubcommand(s =>
      s.setName("global")
        .setDescription("Ranking global de BankCoins")
        .addIntegerOption(o => o.setName("page").setDescription("Pagina inicial").setRequired(false).setMinValue(1))
    )
    .addSubcommand(s =>
      s.setName("local")
        .setDescription("Ranking de moedas do servidor")
        .addStringOption(o =>
          o.setName("type").setDescription("Qual moeda").setRequired(true)
            .addChoices(
              { name: "Server Coin", value: "server" },
              { name: "Global Coin (BankCoin)", value: "global" }
            )
        )
        .addIntegerOption(o => o.setName("page").setDescription("Pagina inicial").setRequired(false).setMinValue(1))
    ),

  async execute(interaction): Promise<void> {
    const lang      = await getUserLang(interaction.user.id) as "pt" | "en";
    const sub       = interaction.options.getSubcommand() as "global" | "local";
    const mode:     LeaderboardMode = sub === "global" ? "global" : "local";
    const coinType: CoinType        = sub === "local"
      ? (interaction.options.getString("type", true) as CoinType)
      : "global";

    const guildId   = interaction.guildId!;
    const viewerId  = interaction.user.id;
    const guildName = interaction.guild?.name ?? "Server";
    let   page      = interaction.options.getInteger("page") ?? 1;

    await interaction.deferReply();

    const result = await buildPage({
      client: interaction.client, guildId, guildName, viewerId, mode, coinType, page, lang
    });

    if (!result.hasCurrency) {
      await interaction.editReply({
        embeds: [new ErrorEmbed(
          lang === "pt"
            ? "Este servidor nao possui moeda propria. Use `/currency-create` para criar uma."
            : "This server has no currency. Use `/currency-create` to create one.",
          lang
        )]
      });
      return;
    }

    page = Math.min(page, result.totalPages);

    const att   = new AttachmentBuilder(result.buffer, { name: "leaderboard.png" });
    const reply = await interaction.editReply({
      files:      [att],
      components: result.totalPages > 1 ? [buildButtons(page, result.totalPages)] : []
    });

    if (result.totalPages <= 1) return;

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter:        (i): i is ButtonInteraction => i.user.id === viewerId,
      time:          120_000
    });

    let totalPages = result.totalPages;

    collector.on("collect", async (btn: ButtonInteraction) => {
      await btn.deferUpdate();
      const prev = page;
      if (btn.customId === "lb_first") page = 1;
      if (btn.customId === "lb_prev")  page = Math.max(1, page - 1);
      if (btn.customId === "lb_next")  page = Math.min(totalPages, page + 1);
      if (btn.customId === "lb_last")  page = totalPages;
      if (page === prev) return;

      const r   = await buildPage({ client: btn.client, guildId, guildName, viewerId, mode, coinType, page, lang });
      totalPages = r.totalPages;
      await btn.editReply({
        files:      [new AttachmentBuilder(r.buffer, { name: "leaderboard.png" })],
        components: [buildButtons(page, r.totalPages)]
      });
    });

    collector.on("end", async () => {
      try { await interaction.editReply({ components: [] }); } catch { /* deleted */ }
    });
  }
} satisfies Command;