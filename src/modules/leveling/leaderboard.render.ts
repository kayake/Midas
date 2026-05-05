import { createCanvas, loadImage } from "@napi-rs/canvas";
import { eq }                      from "drizzle-orm";

import { font }             from "../../shared/fonts";
import { CENTRAL_CURRENCY } from "../../shared/constants";
import { db }               from "../../db/client";
import { shopItems, equippedBadges } from "../../db/schema/index";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank:           number;
  userId:         string;
  username:       string;
  avatarUrl:      string;
  coins:          number;          // the coin being ranked (central or server)
  level:          number;
  isViewer?:      boolean;
  bio?:           string | null;
  // Profile customisation (from users table)
  backgroundId?:  number | null;
  profileColorId?: number | null;
  // Currency display
  currencySymbol:  string;
  currencyImgUrl?: string | null;  // for server coin — the coin image
}

export type LeaderboardMode = "global" | "local";
export type CoinType        = "global" | "server";

// ─── Layout constants ─────────────────────────────────────────────────────────

const CW        = 800;
const ROW_H     = 80;
const HEADER_H  = 60;
const FOOTER_H  = 36;
const AVATAR_R  = 26;
const RANK_W    = 56;   // fixed width column for rank badge
const AVATAR_CX = RANK_W + 18 + AVATAR_R;  // center-x of avatar circle

const RANK_COLORS: Record<number, string> = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32"
};

// ─── Main render ─────────────────────────────────────────────────────────────

export async function renderLeaderboard(
  entries:        LeaderboardEntry[],
  mode:           LeaderboardMode,
  coinType:       CoinType,
  page:           number,
  totalPages:     number,
  guildName:      string,
  lang:           "pt" | "en",
  serverCoinImg?: string | null
): Promise<Buffer> {
  const CH = HEADER_H + entries.length * ROW_H + FOOTER_H;

  const canvas = createCanvas(CW, CH);
  const ctx    = canvas.getContext("2d");

  // Global background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, CH);
  bgGrad.addColorStop(0, "#0f0f1a");
  bgGrad.addColorStop(1, "#13131f");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CW, CH);

  // Top accent bar
  ctx.fillStyle = "#5865F2";
  ctx.fillRect(0, 0, CW, 3);

  // ── Header ──────────────────────────────────────────────────────────────────
  const modeStr = mode === "local"
    ? (lang === "pt" ? `Servidor: ${guildName}` : `Server: ${guildName}`)
    : (lang === "pt" ? "Ranking Global" : "Global Ranking");

  const coinStr = coinType === "server"
    ? (lang === "pt" ? "Moeda do Servidor" : "Server Coin")
    : `BankCoin`;

  ctx.fillStyle = "#ffffff";
  ctx.font      = font(20, "bold");
  ctx.textAlign = "left";
  ctx.fillText(lang === "pt" ? "Ranking de Moedas" : "Coin Leaderboard", 16, 38);

  ctx.fillStyle = "#888899";
  ctx.font      = font(12);
  ctx.textAlign = "right";
  ctx.fillText(`${modeStr}  •  ${coinStr}`, CW - 16, 24);
  ctx.fillText(
    lang === "pt" ? `Pagina ${page} de ${totalPages}` : `Page ${page} of ${totalPages}`,
    CW - 16, 42
  );

  // ── Rows ────────────────────────────────────────────────────────────────────
  for (let i = 0; i < entries.length; i++) {
    await drawRow(ctx, entries[i]!, HEADER_H + i * ROW_H, i % 2 === 0, lang, serverCoinImg);
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = "#33334a";
  ctx.font      = font(10);
  ctx.textAlign = "center";
  ctx.fillText("BankBot  •  UBS Elite Engine", CW / 2, HEADER_H + entries.length * ROW_H + FOOTER_H - 10);

  return canvas.toBuffer("image/png");
}

// ─── Row renderer ─────────────────────────────────────────────────────────────

async function drawRow(
  ctx:           ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  entry:         LeaderboardEntry,
  rowY:          number,
  shaded:        boolean,
  lang:          "pt" | "en",
  serverCoinImg?: string | null
): Promise<void> {
  const rankColor  = RANK_COLORS[entry.rank] ?? "#44445a";
  const isTopThree = entry.rank <= 3;

  // ── Row background — custom or default ────────────────────────────────────
  ctx.save();
  // Clip to row rectangle
  ctx.beginPath();
  ctx.rect(0, rowY, CW, ROW_H);
  ctx.closePath();
  ctx.clip();

  if (entry.backgroundId !== null && entry.backgroundId !== undefined) {
    // Fetch background image URL from shopItems
    try {
      const [bgItem] = await db
        .select({ imageUrl: shopItems.imageUrl })
        .from(shopItems)
        .where(eq(shopItems.id, entry.backgroundId));

      if (bgItem !== undefined) {
        const bgImg = await loadImage(bgItem.imageUrl);
        ctx.drawImage(bgImg, 0, rowY, CW, ROW_H);
        // Dark overlay for legibility
        ctx.fillStyle = "rgba(10,10,22,0.70)";
        ctx.fillRect(0, rowY, CW, ROW_H);
      }
    } catch {
      // fallback to default
      drawDefaultRowBg(ctx, entry, rowY, shaded);
    }
  } else {
    drawDefaultRowBg(ctx, entry, rowY, shaded);
  }

  ctx.restore();

  // Viewer highlight bar
  if (entry.isViewer === true) {
    ctx.fillStyle = "#5865F2";
    ctx.fillRect(0, rowY, 3, ROW_H);
  }

  // ── Rank badge ─────────────────────────────────────────────────────────────
  const rankCY = rowY + ROW_H / 2;
  const rankCX = 28;

  ctx.textAlign = "center";
  if (isTopThree) {
    ctx.beginPath();
    ctx.arc(rankCX, rankCY, 15, 0, Math.PI * 2);
    ctx.fillStyle   = rankColor + "30";
    ctx.fill();
    ctx.strokeStyle = rankColor;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.fillStyle = rankColor;
    ctx.font      = font(13, "bold");
    ctx.fillText(String(entry.rank), rankCX, rankCY + 5);
  } else {
    ctx.fillStyle = "#55556a";
    ctx.font      = font(12);
    ctx.fillText(`#${entry.rank}`, rankCX, rankCY + 5);
  }

  // ── Avatar (no overlap with rank) ──────────────────────────────────────────
  const avatarCX = RANK_W + 14 + AVATAR_R;  // rank col + gap + radius
  const avatarCY = rowY + ROW_H / 2;

  try {
    const img = await loadImage(entry.avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, AVATAR_R, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, avatarCX - AVATAR_R, avatarCY - AVATAR_R, AVATAR_R * 2, AVATAR_R * 2);
    ctx.restore();
  } catch {
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, AVATAR_R, 0, Math.PI * 2);
    ctx.fillStyle = "#2d2d4e";
    ctx.fill();
  }

  // Avatar ring
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, AVATAR_R + 2, 0, Math.PI * 2);
  ctx.strokeStyle = isTopThree ? rankColor : "rgba(255,255,255,0.10)";
  ctx.lineWidth   = isTopThree ? 2 : 1;
  ctx.stroke();

  // ── Badges (max 3, small, right of avatar) ────────────────────────────────
  const badgeStartX = avatarCX + AVATAR_R + 10;
  const badgeSize   = 18;
  const badgeGap    = 4;
  await drawBadges(ctx, entry.userId, badgeStartX, rowY + 8, badgeSize, badgeGap);

  // ── Username + bio + level ────────────────────────────────────────────────
  const nameX    = avatarCX + AVATAR_R + 10;
  const nameBaseY = rowY + ROW_H / 2;

  // Shift down slightly if badges are shown (they occupy top 8+18+4 = 30px)
  const hasBadges = true; // always reserve space
  const nameY     = nameBaseY - (entry.bio ? 8 : 4);
  const subY      = nameY + 16;
  const bioY      = subY + 13;

  ctx.textAlign = "left";

  // Resolve accent color from profileColorId
  const accentColor = await resolveAccentColor(entry.profileColorId ?? null, "#aab4ff");

  ctx.fillStyle = entry.isViewer === true ? accentColor : "#ffffff";
  ctx.font      = font(15, "bold");
  ctx.fillText(truncate(entry.username, 24), nameX, nameY);

  ctx.fillStyle = "#55556a";
  ctx.font      = font(11);
  ctx.fillText(
    lang === "pt" ? `Nivel ${entry.level}` : `Level ${entry.level}`,
    nameX, subY
  );

  if (entry.bio !== null && entry.bio !== undefined && entry.bio.length > 0) {
    ctx.fillStyle = "#777799";
    ctx.font      = font(10);
    ctx.fillText(truncate(entry.bio, 40), nameX, bioY);
  }

  // ── Coins (right side) ────────────────────────────────────────────────────
  const coinsX  = CW - 16;
  const coinsCY = rowY + ROW_H / 2;

  ctx.textAlign = "right";

  // Coin icon — try to draw server coin image or fallback to symbol text
  const iconSize = 18;
  const iconX    = coinsX - ctx.measureText(formatCoins(entry.coins)).width - 4 - iconSize - 4;

  // Main coin amount
  ctx.fillStyle = "#e8e8ff";
  ctx.font      = font(15, "bold");
  const coinText  = formatCoins(entry.coins);
  const coinTextW = ctx.measureText(coinText).width;
  ctx.fillText(coinText, coinsX, coinsCY + 5);

  // Coin symbol / image
  if (serverCoinImg !== null && serverCoinImg !== undefined) {
    // Draw server coin image as small circle left of amount
    try {
      const coinImg = await loadImage(serverCoinImg);
      const iconCX  = coinsX - coinTextW - 6 - iconSize / 2;
      const iconCY  = coinsCY + 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(iconCX, iconCY, iconSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(coinImg, iconCX - iconSize / 2, iconCY - iconSize / 2, iconSize, iconSize);
      ctx.restore();
    } catch {
      // symbol fallback
      ctx.fillStyle = "#888899";
      ctx.font      = font(12);
      ctx.fillText(entry.currencySymbol, coinsX - coinTextW - 4, coinsCY + 5);
    }
  } else {
    // Central coin — draw symbol
    ctx.fillStyle = "#888899";
    ctx.font      = font(13);
    ctx.fillText(entry.currencySymbol, coinsX - coinTextW - 4, coinsCY + 5);
  }

  // ── Row separator ─────────────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, rowY + ROW_H - 0.5);
  ctx.lineTo(CW, rowY + ROW_H - 0.5);
  ctx.stroke();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function drawDefaultRowBg(
  ctx:    ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  entry:  LeaderboardEntry,
  rowY:   number,
  shaded: boolean
): void {
  ctx.fillStyle = entry.isViewer
    ? "rgba(88,101,242,0.13)"
    : shaded
      ? "rgba(255,255,255,0.022)"
      : "rgba(0,0,0,0)";
  ctx.fillRect(0, rowY, CW, ROW_H);
}

async function drawBadges(
  ctx:      ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  userId:   string,
  startX:   number,
  startY:   number,
  size:     number,
  gap:      number
): Promise<void> {
  const badges = await db
    .select({ shopItemId: equippedBadges.shopItemId, slot: equippedBadges.slot })
    .from(equippedBadges)
    .where(eq(equippedBadges.userId, userId));

  if (badges.length === 0) return;

  const RARITY_COLORS: Record<string, string> = {
    common: "#aaaaaa", rare: "#4a90d9", epic: "#9b59b6", legendary: "#f1c40f"
  };

  for (const badge of badges.slice(0, 3)) {
    const [item] = await db
      .select({ imageUrl: shopItems.imageUrl, rarity: shopItems.rarity })
      .from(shopItems)
      .where(eq(shopItems.id, badge.shopItemId));

    if (item === undefined) continue;

    const bx = startX + badge.slot * (size + gap);
    const cx = bx + size / 2;
    const cy = startY + size / 2;

    try {
      const img = await loadImage(item.imageUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, bx, startY, size, size);
      ctx.restore();
    } catch {
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = RARITY_COLORS[item.rarity] ?? "#aaaaaa";
      ctx.fill();
    }

    // Tiny rarity ring
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 + 1, 0, Math.PI * 2);
    ctx.strokeStyle = (RARITY_COLORS[item.rarity] ?? "#aaaaaa") + "88";
    ctx.lineWidth   = 1;
    ctx.stroke();
  }
}

async function resolveAccentColor(
  colorItemId: number | null,
  fallback:    string
): Promise<string> {
  if (colorItemId === null) return fallback;
  try {
    const [item] = await db
      .select({ colorValue: shopItems.colorValue })
      .from(shopItems)
      .where(eq(shopItems.id, colorItemId));
    return item?.colorValue ?? fallback;
  } catch {
    return fallback;
  }
}

function formatCoins(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}