import { createCanvas, loadImage } from "@napi-rs/canvas";
import { font }                 from "../../shared/fonts";
import { eq, and }                 from "drizzle-orm";

import { db }               from "../../db/client";
import {
  guildMembers,
  equippedBadges,
  shopItems,
  serverCurrencies,
  users
} from "../../db/schema/index";
import { levelProgress }    from "../leveling/xp.config";
import { getPlan }          from "../../shared/plans";
import { CENTRAL_CURRENCY } from "../../shared/constants";

export interface ProfileData {
  userId:   string;
  username: string;
  avatarUrl: string;
  guildId:  string;
  planId:   string;
}

const W = 900;
const H = 320;

const RARITY_GLOW: Record<string, string> = {
  common:    "#aaaaaa",
  rare:      "#4a90d9",
  epic:      "#9b59b6",
  legendary: "#f1c40f"
};

// ─── Main render ─────────────────────────────────────────────────────────────

export async function renderProfileCard(data: ProfileData): Promise<Buffer> {
  const { userId, username, avatarUrl, guildId, planId } = data;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");
  const plan   = getPlan(planId);

  // Fetch all DB data in parallel
  const [[member], badges, [currency], [user]] = await Promise.all([
    db.select().from(guildMembers)
      .where(and(eq(guildMembers.userId, userId), eq(guildMembers.guildId, guildId))),
    db.select({ slot: equippedBadges.slot, shopItemId: equippedBadges.shopItemId })
      .from(equippedBadges)
      .where(eq(equippedBadges.userId, userId)),
    db.select().from(serverCurrencies).where(eq(serverCurrencies.guildId, guildId)),
    db.select().from(users).where(eq(users.id, userId))
  ]);

  // ── Background ──────────────────────────────────────────────────────────────
  await drawBackground(ctx, user?.backgroundId ?? null, plan.color);

  // ── Plan color accent bar on the left ───────────────────────────────────────
  ctx.fillStyle = plan.color;
  ctx.fillRect(0, 0, 6, H);

  // ── Avatar (circular) ────────────────────────────────────────────────────────
  const avatarSize = 128;
  const avatarX    = 32;
  const avatarY    = H / 2 - avatarSize / 2;
  await drawAvatar(ctx, avatarUrl, avatarX, avatarY, avatarSize, plan.color);

  // ── Profile color from equipped color item ───────────────────────────────────
  const accentColor = await resolveProfileColor(user?.profileColorId ?? null, plan.color);

  // ── Username ──────────────────────────────────────────────────────────────────
  const textX = avatarX + avatarSize + 28;

  ctx.fillStyle = "#ffffff";
  ctx.font = font(30, "bold");
  ctx.fillText(username, textX, 70);

  // Plan badge
  ctx.fillStyle = accentColor.startsWith("linear") ? plan.color : accentColor;
  ctx.font = font(14, "bold");
  ctx.fillText(`🏦 ${plan.name}  ·  ${plan.label}`, textX, 96);

  // Bio
  if (user?.bio !== undefined && user.bio !== null) {
    ctx.fillStyle = "#cccccc";
    ctx.font = font(14);
    ctx.fillText(user.bio.slice(0, 64), textX, 118);
  }

  // Title
  if (user?.title !== undefined && user.title !== null) {
    ctx.fillStyle = "#e0c070";
    ctx.font = font(13, "italic bold");
    ctx.fillText(`"${user.title}"`, textX, 138);
  }

  // ── XP Bar ───────────────────────────────────────────────────────────────────
  const xp       = member?.xp    ?? 0;
  const level    = member?.level  ?? 1;
  const progress = levelProgress(xp);

  const barX = textX;
  const barY = 162;
  const barW = 420;
  const barH = 16;
  const barR = 8;

  // Label above bar
  ctx.fillStyle = "#ffffff";
  ctx.font = font(13, "bold");
  ctx.fillText(`Level ${level}`, barX, barY - 5);
  ctx.fillStyle = "#999999";
  ctx.font = font(12);
  ctx.fillText(
    `${progress.current.toLocaleString()} / ${progress.needed.toLocaleString()} XP  (${progress.percentage}%)`,
    barX + 76,
    barY - 5
  );

  // Background track
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  drawRoundRect(ctx, barX, barY, barW, barH, barR);
  ctx.fill();

  // Fill — use accentColor (supports gradient)
  const fillW = Math.max(barR * 2, (progress.percentage / 100) * barW);
  if (accentColor.startsWith("linear")) {
    const grad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
    // Parse "linear-gradient(angle, color1, color2, ...)"
    const stops = parseGradientStops(accentColor);
    stops.forEach(({ stop, color }) => grad.addColorStop(stop, color));
    ctx.fillStyle = grad;
  } else {
    const grad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
    grad.addColorStop(0, accentColor);
    grad.addColorStop(1, lighten(accentColor, 50));
    ctx.fillStyle = grad;
  }
  drawRoundRect(ctx, barX, barY, fillW, barH, barR);
  ctx.fill();

  // ── Coins ────────────────────────────────────────────────────────────────────
  const coinsY = barY + barH + 22;

  ctx.fillStyle = "#ffffff";
  ctx.font = font(13);
  ctx.fillText(
    `${CENTRAL_CURRENCY.symbol}  ${(user?.centralCoins ?? 0).toFixed(2)} BankCoins`,
    barX,
    coinsY
  );

  if (currency !== undefined && user !== undefined && member.serverCoins > 0) {
    ctx.fillStyle = "#aaaaaa";
    ctx.fillText(
      `${currency.symbol}  ${member.serverCoins.toFixed(2)} ${currency.name}`,
      barX,
      coinsY + 20
    );
  }

  // ── Equipped Badges ───────────────────────────────────────────────────────────
  if (badges.length > 0) {
    await drawBadges(ctx, badges, W - 210, 48, 56, 14);
  }

  // ── Footer ────────────────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.font = font(11);
  ctx.fillText("BankBot  ·  UBS Elite Engine", W - 186, H - 10);

  return canvas.toBuffer("image/png");
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────

async function drawBackground(
  ctx:      ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  bgItemId: number | null,
  planColor: string
): Promise<void> {
  if (bgItemId !== null) {
    const [item] = await db
      .select({ imageUrl: shopItems.imageUrl })
      .from(shopItems)
      .where(eq(shopItems.id, bgItemId));

    if (item !== undefined) {
      try {
        const img = await loadImage(item.imageUrl);
        // Draw background image covering canvas, then darken it
        ctx.drawImage(img, 0, 0, W, H);
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
        return;
      } catch { /* fall through to default */ }
    }
  }

  // Default: dark gradient with subtle plan color tint
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1a1a2e");
  bg.addColorStop(0.6, "#16213e");
  bg.addColorStop(1, hexWithAlpha(planColor, 0.15));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
}

async function drawAvatar(
  ctx:      ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  url:      string,
  x:        number,
  y:        number,
  size:     number,
  borderColor: string
): Promise<void> {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r  = size / 2;

  try {
    const img = await loadImage(url);

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
  } catch {
    // Fallback
    ctx.fillStyle = borderColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glowing border ring
  ctx.save();
  ctx.shadowColor = borderColor;
  ctx.shadowBlur  = 16;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

async function drawBadges(
  ctx:    ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  badges: { slot: number; shopItemId: number }[],
  startX: number,
  startY: number,
  size:   number,
  gap:    number
): Promise<void> {
  // Fetch all badge items in one query
  const ids   = badges.map(b => b.shopItemId);
  const items = await Promise.all(
    ids.map(id => db.select().from(shopItems).where(eq(shopItems.id, id)).then(r => r[0]))
  );

  for (const badge of badges) {
    const item = items.find(i => i?.id === badge.shopItemId);
    if (item === undefined) continue;

    const bx = startX + badge.slot * (size + gap);
    const cx = bx + size / 2;
    const cy = startY + size / 2;

    // Rarity glow
    ctx.save();
    ctx.shadowColor = RARITY_GLOW[item.rarity] ?? "#aaaaaa";
    ctx.shadowBlur  = 14;

    try {
      const img = await loadImage(item.imageUrl);
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, bx, startY, size, size);
    } catch {
      ctx.fillStyle = RARITY_GLOW[item.rarity] ?? "#aaaaaa";
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.shadowBlur = 0;

    // Rarity ring
    ctx.strokeStyle = RARITY_GLOW[item.rarity] ?? "#aaaaaa";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 + 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}

async function resolveProfileColor(
  colorItemId: number | null,
  fallback:    string
): Promise<string> {
  if (colorItemId === null) return fallback;

  const [item] = await db
    .select({ colorValue: shopItems.colorValue })
    .from(shopItems)
    .where(eq(shopItems.id, colorItemId));

  return item?.colorValue ?? fallback;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function drawRoundRect(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function lighten(hex: string, amount = 60): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amount);
  const g = Math.min(255, ((n >> 8)  & 0xff) + amount);
  const b = Math.min(255,  (n        & 0xff) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hexWithAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8)  & 0xff;
  const b =  n        & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Parses a CSS linear-gradient string into evenly spaced color stops.
 * Supports: "linear-gradient(angle, #color1, #color2, ...)"
 */
function parseGradientStops(css: string): { stop: number; color: string }[] {
  const inner  = css.replace(/^linear-gradient\([^,]+,\s*/, "").replace(/\)$/, "");
  const colors = inner.split(",").map(c => c.trim()).filter(Boolean);
  if (colors.length === 0) return [{ stop: 0, color: "#ffffff" }];
  return colors.map((color, i) => ({
    stop:  i / Math.max(1, colors.length - 1),
    color
  }));
}