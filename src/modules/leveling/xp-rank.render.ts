import { createCanvas, loadImage } from "@napi-rs/canvas";
import { eq }                      from "drizzle-orm";

import { font }             from "../../shared/fonts";
import { db }               from "../../db/client";
import { shopItems, equippedBadges, users } from "../../db/schema/index";
import { levelProgress, calcLevel } from "./xp.config";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface XPRankEntry {
  rank:           number;
  userId:         string;
  username:       string;
  avatarUrl:      string;
  xp:             number;
  level:          number;
  isViewer?:      boolean;
  bio?:           string | null;
  backgroundId?:  number | null;
  profileColorId?: number | null;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

const CW       = 800;
const ROW_H    = 88;
const HEADER_H = 60;
const FOOTER_H = 36;
const AVATAR_R = 26;
const RANK_W   = 56;

const RANK_COLORS: Record<number, string> = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32"
};

// ─── Main render ─────────────────────────────────────────────────────────────

export async function renderXPRank(
  entries:    XPRankEntry[],
  page:       number,
  totalPages: number,
  guildName:  string,
  lang:       "pt" | "en"
): Promise<Buffer> {
  const CH = HEADER_H + entries.length * ROW_H + FOOTER_H;
  const canvas = createCanvas(CW, CH);
  const ctx    = canvas.getContext("2d");

  // Global bg
  const bg = ctx.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0, "#0f0f1a");
  bg.addColorStop(1, "#13131f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CW, CH);

  // Top accent — XP gold tone
  ctx.fillStyle = "#FFD700";
  ctx.fillRect(0, 0, CW, 3);

  // Header
  ctx.fillStyle = "#ffffff";
  ctx.font      = font(20, "bold");
  ctx.textAlign = "left";
  ctx.fillText(lang === "pt" ? "Ranking de XP" : "XP Leaderboard", 16, 38);

  ctx.fillStyle = "#888899";
  ctx.font      = font(12);
  ctx.textAlign = "right";
  ctx.fillText(guildName, CW - 16, 24);
  ctx.fillText(lang === "pt" ? `Pagina ${page} de ${totalPages}` : `Page ${page} of ${totalPages}`, CW - 16, 42);

  for (let i = 0; i < entries.length; i++) {
    await drawXPRow(ctx, entries[i]!, HEADER_H + i * ROW_H, i % 2 === 0, lang);
  }

  // Footer
  ctx.fillStyle = "#33334a";
  ctx.font      = font(10);
  ctx.textAlign = "center";
  ctx.fillText("BankBot  •  UBS Elite Engine", CW / 2, HEADER_H + entries.length * ROW_H + FOOTER_H - 10);

  return canvas.toBuffer("image/png");
}

// ─── Row ─────────────────────────────────────────────────────────────────────

async function drawXPRow(
  ctx:    ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  entry:  XPRankEntry,
  rowY:   number,
  shaded: boolean,
  lang:   "pt" | "en"
): Promise<void> {
  const rankColor  = RANK_COLORS[entry.rank] ?? "#44445a";
  const isTopThree = entry.rank <= 3;
  const progress   = levelProgress(entry.xp);

  // ── Row bg ────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, rowY, CW, ROW_H);
  ctx.clip();

  if (entry.backgroundId !== null && entry.backgroundId !== undefined) {
    try {
      const [bgItem] = await db.select({ imageUrl: shopItems.imageUrl }).from(shopItems).where(eq(shopItems.id, entry.backgroundId));
      if (bgItem !== undefined) {
        const bgImg = await loadImage(bgItem.imageUrl);
        ctx.drawImage(bgImg, 0, rowY, CW, ROW_H);
        ctx.fillStyle = "rgba(10,10,22,0.72)";
        ctx.fillRect(0, rowY, CW, ROW_H);
      } else { defaultBg(ctx, entry, rowY, shaded); }
    } catch { defaultBg(ctx, entry, rowY, shaded); }
  } else {
    defaultBg(ctx, entry, rowY, shaded);
  }
  ctx.restore();

  // Viewer bar
  if (entry.isViewer === true) {
    ctx.fillStyle = "#FFD700";
    ctx.fillRect(0, rowY, 3, ROW_H);
  }

  // ── Rank ──────────────────────────────────────────────────────────────────
  const rankCX = 28;
  const rankCY = rowY + ROW_H / 2;
  ctx.textAlign = "center";

  if (isTopThree) {
    ctx.beginPath();
    ctx.arc(rankCX, rankCY, 15, 0, Math.PI * 2);
    ctx.fillStyle = rankColor + "30"; ctx.fill();
    ctx.strokeStyle = rankColor; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = rankColor; ctx.font = font(13, "bold");
    ctx.fillText(String(entry.rank), rankCX, rankCY + 5);
  } else {
    ctx.fillStyle = "#55556a"; ctx.font = font(12);
    ctx.fillText(`#${entry.rank}`, rankCX, rankCY + 5);
  }

  // ── Avatar ────────────────────────────────────────────────────────────────
  const avatarCX = RANK_W + 14 + AVATAR_R;
  const avatarCY = rowY + ROW_H / 2 - 6; // shift up a bit for progress bar space

  try {
    const img = await loadImage(entry.avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, AVATAR_R, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, avatarCX - AVATAR_R, avatarCY - AVATAR_R, AVATAR_R * 2, AVATAR_R * 2);
    ctx.restore();
  } catch {
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, AVATAR_R, 0, Math.PI * 2);
    ctx.fillStyle = "#2d2d4e"; ctx.fill();
  }

  // Avatar ring — gold for top 3
  ctx.beginPath();
  ctx.arc(avatarCX, avatarCY, AVATAR_R + 2, 0, Math.PI * 2);
  ctx.strokeStyle = isTopThree ? rankColor : "rgba(255,255,255,0.10)";
  ctx.lineWidth   = isTopThree ? 2 : 1;
  ctx.stroke();

  // ── Badges ────────────────────────────────────────────────────────────────
  await drawBadges(ctx, entry.userId, avatarCX + AVATAR_R + 10, rowY + 6, 16, 4);

  // ── Name + level ──────────────────────────────────────────────────────────
  const nameX   = avatarCX + AVATAR_R + 10;
  const accentColor = await resolveAccentColor(entry.profileColorId ?? null, "#FFD700");

  ctx.textAlign = "left";
  ctx.fillStyle = entry.isViewer === true ? accentColor : "#ffffff";
  ctx.font      = font(15, "bold");
  ctx.fillText(truncate(entry.username, 24), nameX, rowY + ROW_H / 2 - 10);

  ctx.fillStyle = "#55556a";
  ctx.font      = font(11);
  ctx.fillText(lang === "pt" ? `Nivel ${entry.level}` : `Level ${entry.level}`, nameX, rowY + ROW_H / 2 + 6);

  if (entry.bio !== null && entry.bio !== undefined) {
    ctx.fillStyle = "#666688"; ctx.font = font(10);
    ctx.fillText(truncate(entry.bio, 36), nameX, rowY + ROW_H / 2 + 20);
  }

  // ── XP + progress bar (right side) ───────────────────────────────────────
  const barX  = CW - 220;
  const barY  = rowY + ROW_H / 2 + 8;
  const barW  = 180;
  const barH  = 10;
  const barR  = 5;

  // XP text above bar
  ctx.fillStyle   = "#e8e8ff";
  ctx.font        = font(13, "bold");
  ctx.textAlign   = "right";
  ctx.fillText(`${formatXP(entry.xp)} XP`, barX + barW, rowY + ROW_H / 2 - 4);

  // Track
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  roundRect(ctx, barX, barY, barW, barH, barR); ctx.fill();

  // Fill with accent color
  const fillW = Math.max(barR * 2, (progress.percentage / 100) * barW);
  const grad  = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
  grad.addColorStop(0, accentColor);
  grad.addColorStop(1, lighten(accentColor, 40));
  ctx.fillStyle   = grad;
  ctx.shadowColor = accentColor;
  ctx.shadowBlur  = 5;
  roundRect(ctx, barX, barY, fillW, barH, barR); ctx.fill();
  ctx.shadowBlur  = 0;

  // Progress label
  ctx.fillStyle = "#555577"; ctx.font = font(10); ctx.textAlign = "right";
  ctx.fillText(
    `${progress.current.toLocaleString()} / ${progress.needed.toLocaleString()} XP`,
    barX + barW, barY + barH + 12
  );

  // Separator
  ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, rowY + ROW_H - 0.5);
  ctx.lineTo(CW, rowY + ROW_H - 0.5);
  ctx.stroke();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultBg(
  ctx:    ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  entry:  XPRankEntry,
  rowY:   number,
  shaded: boolean
): void {
  ctx.fillStyle = entry.isViewer
    ? "rgba(255,215,0,0.08)"
    : shaded ? "rgba(255,255,255,0.022)" : "rgba(0,0,0,0)";
  ctx.fillRect(0, rowY, CW, ROW_H);
}

async function drawBadges(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  userId: string, startX: number, startY: number, size: number, gap: number
): Promise<void> {
  const RARITY: Record<string, string> = { common: "#aaa", rare: "#4a90d9", epic: "#9b59b6", legendary: "#f1c40f" };
  const badges = await db.select({ shopItemId: equippedBadges.shopItemId, slot: equippedBadges.slot }).from(equippedBadges).where(eq(equippedBadges.userId, userId));
  for (const b of badges.slice(0, 3)) {
    const [item] = await db.select({ imageUrl: shopItems.imageUrl, rarity: shopItems.rarity }).from(shopItems).where(eq(shopItems.id, b.shopItemId));
    if (!item) continue;
    const bx = startX + b.slot * (size + gap), cx = bx + size / 2, cy = startY + size / 2;
    try {
      const img = await loadImage(item.imageUrl);
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(img, bx, startY, size, size); ctx.restore();
    } catch {
      ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = RARITY[item.rarity] ?? "#aaa"; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(cx, cy, size / 2 + 1, 0, Math.PI * 2);
    ctx.strokeStyle = (RARITY[item.rarity] ?? "#aaa") + "88"; ctx.lineWidth = 1; ctx.stroke();
  }
}

async function resolveAccentColor(colorItemId: number | null, fallback: string): Promise<string> {
  if (colorItemId === null) return fallback;
  try {
    const [item] = await db.select({ colorValue: shopItems.colorValue }).from(shopItems).where(eq(shopItems.id, colorItemId));
    return item?.colorValue ?? fallback;
  } catch { return fallback; }
}

function roundRect(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function lighten(hex: string, amt = 40): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amt);
  const g = Math.min(255, ((n >> 8)  & 0xff) + amt);
  const b = Math.min(255,  (n        & 0xff) + amt);
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}

function formatXP(xp: number): string {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
  if (xp >= 1_000)     return `${(xp / 1_000).toFixed(1)}K`;
  return xp.toLocaleString();
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}