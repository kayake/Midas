import { createCanvas, loadImage } from "@napi-rs/canvas";
import { eq }                      from "drizzle-orm";

import { font }    from "../../shared/fonts";
import { db }      from "../../db/client";
import { shopItems, equippedBadges } from "../../db/schema/index";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MissionRankEntry {
  rank:            number;
  userId:          string;
  username:        string;
  avatarUrl:       string;
  completed:       number;   // total missions completed today
  claimed:         number;   // total rewards claimed today
  streak:          number;   // consecutive days with at least 1 mission completed
  isViewer?:       boolean;
  backgroundId?:   number | null;
  profileColorId?: number | null;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

const CW       = 800;
const ROW_H    = 80;
const HEADER_H = 60;
const FOOTER_H = 36;
const AVATAR_R = 26;
const RANK_W   = 56;

const RANK_COLORS: Record<number, string> = {
  1: "#FFD700",
  2: "#C0C0C0",
  3: "#CD7F32"
};

// Completion rate color
function completionColor(completed: number, total: number): string {
  const pct = total === 0 ? 0 : completed / total;
  if (pct >= 1)   return "#57F287"; // all done — green
  if (pct >= 0.5) return "#FEE75C"; // half — yellow
  return "#ED4245";                  // low — red
}

// ─── Main render ─────────────────────────────────────────────────────────────

export async function renderMissionRank(
  entries:    MissionRankEntry[],
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

  // Top accent — mission green
  ctx.fillStyle = "#57F287";
  ctx.fillRect(0, 0, CW, 3);

  // Header
  ctx.fillStyle = "#ffffff";
  ctx.font      = font(20, "bold");
  ctx.textAlign = "left";
  ctx.fillText(lang === "pt" ? "Ranking de Missoes" : "Mission Leaderboard", 16, 38);

  ctx.fillStyle = "#888899";
  ctx.font      = font(12);
  ctx.textAlign = "right";
  ctx.fillText(guildName, CW - 16, 24);
  ctx.fillText(
    lang === "pt" ? `Pagina ${page} de ${totalPages}` : `Page ${page} of ${totalPages}`,
    CW - 16, 42
  );

  for (let i = 0; i < entries.length; i++) {
    await drawMissionRow(ctx, entries[i]!, HEADER_H + i * ROW_H, i % 2 === 0, lang);
  }

  ctx.fillStyle = "#33334a";
  ctx.font      = font(10);
  ctx.textAlign = "center";
  ctx.fillText("BankBot  •  UBS Elite Engine", CW / 2, HEADER_H + entries.length * ROW_H + FOOTER_H - 10);

  return canvas.toBuffer("image/png");
}

// ─── Row ─────────────────────────────────────────────────────────────────────

async function drawMissionRow(
  ctx:    ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  entry:  MissionRankEntry,
  rowY:   number,
  shaded: boolean,
  lang:   "pt" | "en"
): Promise<void> {
  const rankColor  = RANK_COLORS[entry.rank] ?? "#44445a";
  const isTopThree = entry.rank <= 3;

  // Row bg
  ctx.save();
  ctx.beginPath(); ctx.rect(0, rowY, CW, ROW_H); ctx.clip();
  if (entry.backgroundId !== null && entry.backgroundId !== undefined) {
    try {
      const [bgItem] = await db.select({ imageUrl: shopItems.imageUrl }).from(shopItems).where(eq(shopItems.id, entry.backgroundId));
      if (bgItem !== undefined) {
        const img = await loadImage(bgItem.imageUrl);
        ctx.drawImage(img, 0, rowY, CW, ROW_H);
        ctx.fillStyle = "rgba(10,10,22,0.72)"; ctx.fillRect(0, rowY, CW, ROW_H);
      } else { defaultBg(ctx, entry, rowY, shaded); }
    } catch { defaultBg(ctx, entry, rowY, shaded); }
  } else { defaultBg(ctx, entry, rowY, shaded); }
  ctx.restore();

  // Viewer bar — green for missions
  if (entry.isViewer === true) {
    ctx.fillStyle = "#57F287";
    ctx.fillRect(0, rowY, 3, ROW_H);
  }

  // Rank badge
  const rankCX = 28, rankCY = rowY + ROW_H / 2;
  ctx.textAlign = "center";
  if (isTopThree) {
    ctx.beginPath(); ctx.arc(rankCX, rankCY, 15, 0, Math.PI * 2);
    ctx.fillStyle = rankColor + "30"; ctx.fill();
    ctx.strokeStyle = rankColor; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = rankColor; ctx.font = font(13, "bold");
    ctx.fillText(String(entry.rank), rankCX, rankCY + 5);
  } else {
    ctx.fillStyle = "#55556a"; ctx.font = font(12);
    ctx.fillText(`#${entry.rank}`, rankCX, rankCY + 5);
  }

  // Avatar
  const avatarCX = RANK_W + 14 + AVATAR_R, avatarCY = rowY + ROW_H / 2;
  try {
    const img = await loadImage(entry.avatarUrl);
    ctx.save(); ctx.beginPath(); ctx.arc(avatarCX, avatarCY, AVATAR_R, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(img, avatarCX - AVATAR_R, avatarCY - AVATAR_R, AVATAR_R * 2, AVATAR_R * 2); ctx.restore();
  } catch {
    ctx.beginPath(); ctx.arc(avatarCX, avatarCY, AVATAR_R, 0, Math.PI * 2); ctx.fillStyle = "#2d2d4e"; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(avatarCX, avatarCY, AVATAR_R + 2, 0, Math.PI * 2);
  ctx.strokeStyle = isTopThree ? rankColor : "rgba(255,255,255,0.10)"; ctx.lineWidth = isTopThree ? 2 : 1; ctx.stroke();

  // Badges
  await drawBadges(ctx, entry.userId, avatarCX + AVATAR_R + 10, rowY + 8, 16, 4);

  // Name + streak
  const nameX       = avatarCX + AVATAR_R + 10;
  const accentColor = await resolveAccentColor(entry.profileColorId ?? null, "#57F287");

  ctx.textAlign = "left";
  ctx.fillStyle = entry.isViewer === true ? accentColor : "#ffffff";
  ctx.font      = font(15, "bold");
  ctx.fillText(truncate(entry.username, 24), nameX, rowY + ROW_H / 2 - 6);

  // Streak
  if (entry.streak > 1) {
    ctx.fillStyle = "#FEE75C";
    ctx.font      = font(11);
    ctx.fillText(`🔥 ${entry.streak}d streak`, nameX, rowY + ROW_H / 2 + 11);
  }

  // ── Completion stats (right side) ─────────────────────────────────────────
  const statsX = CW - 16;

  // Completed count big
  const compColor = completionColor(entry.completed, Math.max(entry.completed, entry.claimed, 3));
  ctx.fillStyle   = compColor;
  ctx.font        = font(18, "bold");
  ctx.textAlign   = "right";
  ctx.fillText(`${entry.completed}`, statsX, rowY + ROW_H / 2 - 2);

  // Label
  ctx.fillStyle = "#555577"; ctx.font = font(10);
  ctx.fillText(lang === "pt" ? "completas" : "completed", statsX, rowY + ROW_H / 2 + 12);

  // Claimed pill
  if (entry.claimed > 0) {
    const pillText = `✓ ${entry.claimed} ${lang === "pt" ? "coletadas" : "claimed"}`;
    const pillW    = 100;
    const pillX    = statsX - pillW;
    const pillY    = rowY + ROW_H / 2 - 14;
    roundRect(ctx, pillX, pillY, pillW, 16, 4);
    ctx.fillStyle = "rgba(87,242,135,0.15)"; ctx.fill();
    ctx.fillStyle = "#57F287"; ctx.font = font(9, "bold"); ctx.textAlign = "right";
    ctx.fillText(pillText, statsX - 4, pillY + 11);
  }

  // Separator
  ctx.strokeStyle = "rgba(255,255,255,0.04)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, rowY + ROW_H - 0.5); ctx.lineTo(CW, rowY + ROW_H - 0.5); ctx.stroke();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function defaultBg(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>, entry: MissionRankEntry, rowY: number, shaded: boolean): void {
  ctx.fillStyle = entry.isViewer ? "rgba(87,242,135,0.08)" : shaded ? "rgba(255,255,255,0.022)" : "rgba(0,0,0,0)";
  ctx.fillRect(0, rowY, CW, ROW_H);
}

async function drawBadges(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>, userId: string, startX: number, startY: number, size: number, gap: number): Promise<void> {
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
      ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.fillStyle = RARITY[item.rarity] ?? "#aaa"; ctx.fill();
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

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}