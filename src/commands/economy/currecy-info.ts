import { SlashCommandBuilder, AttachmentBuilder } from "discord.js";
import { createCanvas }                           from "@napi-rs/canvas";
import { eq, isNull }                             from "drizzle-orm";

import { db }                    from "../../db/client";
import { serverCurrencies, inflationLog, guilds } from "../../db/schema/index";
import { effectiveRate }         from "../../modules/economy/inflation.service";
import { computeAutoRate }       from "../../modules/economy/exchange.service";
import { EmbedStructure, ErrorEmbed } from "../../shared/EmbedStructure";
import { getUserLang, t }           from "../../i18n/index";
import { CENTRAL_CURRENCY }      from "../../shared/constants";
import { font }                  from "../../shared/fonts";

import type { Command } from "../../shared/types";

// ─── Chart config ─────────────────────────────────────────────────────────────
const CW  = 720;
const CH  = 240;
const PAD = { top: 52, right: 24, bottom: 36, left: 20 };

// ─── Chart render ─────────────────────────────────────────────────────────────

function renderChart(
  history:  { rateAfter: number; createdAt: Date }[],
  isUp:     boolean,
  label:    string,
  current:  number,
  delta:    string
): Buffer {
  const canvas    = createCanvas(CW, CH);
  const ctx       = canvas.getContext("2d");
  const lineColor = isUp ? "#00c853" : "#ff1744";
  const plotW     = CW - PAD.left - PAD.right;
  const plotH     = CH - PAD.top  - PAD.bottom;

  // Background
  ctx.fillStyle = "#0d0f14";
  ctx.fillRect(0, 0, CW, CH);

  // ── Header ─────────────────────────────────────────────────────────────────
  const currentPct = `${(current * 100).toFixed(2)}%`;

  ctx.fillStyle = "#ffffff";
  ctx.font      = font(26, "bold");
  ctx.textAlign = "left";
  ctx.fillText(currentPct, PAD.left, 34);

  // Measure text width to position delta right after
  const pctWidth = ctx.measureText(currentPct).width;

  ctx.fillStyle = lineColor;
  ctx.font      = font(13, "bold");
  ctx.fillText(delta, PAD.left + pctWidth + 10, 32);

  // Label top-right (no emojis — only ASCII to be safe)
  ctx.fillStyle   = "#555577";
  ctx.font        = font(11);
  ctx.textAlign   = "right";
  ctx.fillText(label.toUpperCase(), CW - PAD.right, 16);

  // ── No data fallback ───────────────────────────────────────────────────────
  if (history.length < 2) {
    ctx.fillStyle = "#444466";
    ctx.font      = font(13);
    ctx.textAlign = "center";
    ctx.fillText("Insuficient data", CW / 2, PAD.top + plotH / 2);
    return canvas.toBuffer("image/png");
  }

  const rates = history.map(h => h.rateAfter);
  const minR  = Math.min(...rates);
  const maxR  = Math.max(...rates);
  const range = maxR - minR || 0.001;

  const toX = (i: number): number =>
    PAD.left + (i / (rates.length - 1)) * plotW;
  const toY = (r: number): number =>
    PAD.top + plotH - ((r - minR) / range) * plotH;

  // ── Gradient fill ──────────────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
  grad.addColorStop(0,   rgba(lineColor, 0.20));
  grad.addColorStop(0.65, rgba(lineColor, 0.05));
  grad.addColorStop(1,   rgba(lineColor, 0.00));

  ctx.beginPath();
  ctx.moveTo(toX(0), toY(rates[0]!));
  for (let i = 1; i < rates.length; i++) {
    const cpX = (toX(i - 1) + toX(i)) / 2;
    ctx.bezierCurveTo(cpX, toY(rates[i - 1]!), cpX, toY(rates[i]!), toX(i), toY(rates[i]!));
  }
  ctx.lineTo(toX(rates.length - 1), PAD.top + plotH);
  ctx.lineTo(PAD.left, PAD.top + plotH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // ── Main line ──────────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(toX(0), toY(rates[0]!));
  for (let i = 1; i < rates.length; i++) {
    const cpX = (toX(i - 1) + toX(i)) / 2;
    ctx.bezierCurveTo(cpX, toY(rates[i - 1]!), cpX, toY(rates[i]!), toX(i), toY(rates[i]!));
  }
  ctx.strokeStyle = lineColor;
  ctx.lineWidth   = 2;
  ctx.lineJoin    = "round";
  ctx.shadowColor = lineColor;
  ctx.shadowBlur  = 6;
  ctx.stroke();
  ctx.shadowBlur  = 0;

  // ── Last point dot + dashed vertical ──────────────────────────────────────
  const lx = toX(rates.length - 1);
  const ly = toY(rates[rates.length - 1]!);

  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = rgba(lineColor, 0.35);
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(lx, PAD.top);
  ctx.lineTo(lx, PAD.top + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Glow ring
  ctx.beginPath();
  ctx.arc(lx, ly, 7, 0, Math.PI * 2);
  ctx.fillStyle = rgba(lineColor, 0.22);
  ctx.fill();

  // Solid dot
  ctx.beginPath();
  ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
  ctx.fillStyle   = lineColor;
  ctx.shadowColor = lineColor;
  ctx.shadowBlur  = 8;
  ctx.fill();
  ctx.shadowBlur  = 0;

  // ── Date labels (first / last, dd/mm only) ────────────────────────────────
  const fmt = (d: Date): string =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

  ctx.fillStyle = "#444466";
  ctx.font      = font(11);

  ctx.textAlign = "left";
  if (history[0]?.createdAt !== undefined) {
    ctx.fillText(fmt(history[0].createdAt), PAD.left, CH - 8);
  }
  ctx.textAlign = "right";
  const last = history.at(-1);
  if (last?.createdAt !== undefined) {
    ctx.fillText(fmt(last.createdAt), CW - PAD.right, CH - 8);
  }

  // ── Baseline ──────────────────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top + plotH);
  ctx.lineTo(CW - PAD.right, PAD.top + plotH);
  ctx.stroke();

  return canvas.toBuffer("image/png");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 0xff},${(n >> 8) & 0xff},${n & 0xff},${alpha})`;
}

function fmtPct(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

function calcDelta(current: number, previous: number): { text: string; isUp: boolean } {
  if (previous === 0) return { text: "N/A", isUp: true };
  const pct  = ((current - previous) / Math.abs(previous)) * 100;
  const isUp = pct >= 0;
  // Use ASCII arrows instead of Unicode to avoid missing glyph boxes
  return { text: `${isUp ? "+" : "-"}${Math.abs(pct).toFixed(2)}%`, isUp };
}

function safeTs(d: Date | null | undefined): string {
  if (d === null || d === undefined) return "???";
  return `<t:${Math.floor(new Date(d).getTime() / 1000)}:F>`;
}

// ─── Command ──────────────────────────────────────────────────────────────────

export default {
  data: new SlashCommandBuilder()
    .setName("currency-info")
    .setDescription("Show information and inflation chart for a server currency or the global BankCoin")
    .addStringOption(o =>
      o.setName("coin")
        .setDescription("Name of the currency server to check (empty for global BankCoin)")
        .setRequired(false)
    ),

  async execute(interaction): Promise<void> {
    const lang       = await getUserLang(interaction.user.id);
    const coin = interaction.options.getString("coin") ?? null;
    const currencyInfo = t("command.currency_info", lang);
    const isGlobal   = coin === null;

    await interaction.deferReply();

    // ── Global BankCoin ────────────────────────────────────────────────────
    if (isGlobal) {
      const raw = await db
        .select({ rateAfter: inflationLog.rateAfter, rateBefore: inflationLog.rateBefore, createdAt: inflationLog.createdAt })
        .from(inflationLog)
        .where(eq(inflationLog.guildId, "central"))
        .orderBy(inflationLog.createdAt)
        .limit(60);

      const history = raw
        .filter((h): h is { rateAfter: number; rateBefore: number; createdAt: Date } => h.createdAt !== null);

      const currentRate               = history.at(-1)?.rateAfter ?? 0;
      const prevRate                  = history.at(-2)?.rateAfter ?? currentRate;
      const { text: deltaText, isUp } = calcDelta(currentRate, prevRate);

      const chartBuf   = renderChart(history, isUp, "BankCoin Global", currentRate, deltaText);
      const attachment = new AttachmentBuilder(chartBuf, { name: "chart.png" });

      const trendIcon = isUp ? "↑" : "↓";

      const embed = new EmbedStructure({ color: isUp ? "#00c853" : "#ff1744", lang })
        .setTitle(`${CENTRAL_CURRENCY.symbol} - Global`)
        .addFields(
          { name: currencyInfo.symbol,    value: CENTRAL_CURRENCY.symbol, inline: true },
          { name: currencyInfo.name,       value: "Global",           inline: true },
          { name: currencyInfo.inflation,   value: `**${fmtPct(currentRate)}** ${trendIcon}`, inline: true },
          { name: currencyInfo.variation,   value: `${isUp ? "▲" : "▼"} ${deltaText}`,       inline: true },
        )
        .setImage("attachment://chart.png");

      await interaction.editReply({ embeds: [embed], files: [attachment] });
      return;
    }
    
    // ── Server currency ────────────────────────────────────────────────────
    const [currency] = await db
      .select()
      .from(serverCurrencies)
      .where(eq(serverCurrencies.name, coin));

    if (currency === undefined) {
      await interaction.editReply({
        embeds: [new ErrorEmbed(
          currencyInfo.error.no_currency,
          lang
        )]
      });
      return;
    }

    let guildName = `\`${currency.guildId}\``;
    try {
      const dg  = await interaction.client.guilds.fetch(currency.guildId);
      guildName = dg.name;
    } catch { /* not in cache */ }


    const raw = await db
      .select({ rateAfter: inflationLog.rateAfter, rateBefore: inflationLog.rateBefore, createdAt: inflationLog.createdAt })
      .from(inflationLog)
      .where(eq(inflationLog.guildId, currency.guildId))
      .orderBy(inflationLog.createdAt)
      .limit(60);

    const history = raw
      .filter((h): h is { rateAfter: number; rateBefore: number; createdAt: Date } => h.createdAt !== null);

    const currentRate                = effectiveRate(currency);
    const prevRate                   = history.at(-2)?.rateAfter ?? history.at(-1)?.rateAfter ?? currentRate;
    const { text: deltaText, isUp }  = calcDelta(currentRate, prevRate);
    const exchangeRate               = await computeAutoRate(currency.guildId, null);

    const emojiStr = currency.emojiCreated && currency.emojiId !== null
      ? `<:${currency.name.toLowerCase().replace(/\s+/g, "_")}_${currency.guildId}:${currency.emojiId}>`
      : currency.symbol;

    const chartBuf    = renderChart(history, isUp, `${currency.name} (${currency.symbol})`, currentRate, deltaText);
    const attachment  = new AttachmentBuilder(chartBuf, { name: "chart.png" });

    const inflationMode = currency.inflationOverride !== null ? " *(manual)*" : " *(auto)*";
    const trendIcon     = isUp ? "↑" : "↓";

    const embed = new EmbedStructure({ color: isUp ? "#00c853" : "#ff1744", lang })
      .setTitle(`${emojiStr} ${currency.name} (${currency.symbol})`)
      .setThumbnail(currency.imageUrl)
      .addFields(
        { name: currencyInfo.name,        value: currency.name,                                 inline: true  },
        { name: currencyInfo.symbol,     value: `\`${currency.symbol}\``,                      inline: true  },
        { name: currencyInfo.server,    value: guildName,                                      inline: true  },
        { name: currencyInfo.createdAt,   value: safeTs(currency.createdAt),                    inline: false },
        { name: currencyInfo.inflation,
          value: `**${fmtPct(currentRate)}** ${trendIcon}${inflationMode}`,           inline: true  },
        { name: currencyInfo.variation,
          value: `${isUp ? "▲" : "▼"} ${deltaText}`,                                 inline: true  },
        { name: "Supply (ALG)",
          value: `\`${currency.totalSupply.toLocaleString("pt-BR")}\``,              inline: true  },
        { name: `vs ${CENTRAL_CURRENCY.symbol} Global`,
          value: `\`1 ${currency.symbol} = ${exchangeRate.toFixed(6)} ${CENTRAL_CURRENCY.symbol}\``,
          inline: false },
        { name: currencyInfo.lastUpdate,
          value: currency.lastInflationAt !== null
            ? `<t:${Math.floor(new Date(currency.lastInflationAt).getTime() / 1000)}:R>`
            : "N/A",                                                                 inline: true  }
      )
      .setImage("attachment://chart.png");

    await interaction.editReply({ embeds: [embed], files: [attachment] });
  }
} satisfies Command;