import { createCanvas } from "@napi-rs/canvas";

import { font }         from "../../shared/fonts";
import { CENTRAL_CURRENCY } from "../../shared/constants";

import type { Mission } from "./mission.types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MissionRenderEntry {
  mission:   Mission;
  progress:  number;
  completed: boolean;
  claimed:   boolean;
}

// ─── Plan theme per required plan ─────────────────────────────────────────────
// Each plan has:
//   bg        — card background color
//   accent    — progress bar + border color
//   badge     — small plan label background

const PLAN_THEME: Record<string, { bg: string; accent: string; badge: string; label: string }> = {
  hsbc:     { bg: "#1a0a0c", accent: "#DB0011", badge: "#3d0009", label: "HSBC"     },
  barclays: { bg: "#071624", accent: "#00AEEF", badge: "#002f4a", label: "Barclays" },
  deutsche: { bg: "#07091f", accent: "#4a5bff", badge: "#0d1155", label: "Deutsche" },
  ubs:      { bg: "#1a100a", accent: "#E30613", badge: "#450a00", label: "UBS"      }
};

const TYPE_LABEL: Record<string, { pt: string; en: string; icon: string }> = {
  send_messages:        { pt: "Mensagens",  en: "Messages",   icon: "💬" },
  voice_minutes:        { pt: "Minutos voz",en: "Voice min",  icon: "🎙" },
  buy_item:             { pt: "Comprar item",en: "Buy item",  icon: "🛒" },
  gain_xp:              { pt: "Ganhar XP",  en: "Gain XP",   icon: "⭐" },
  reach_level:          { pt: "Atingir niv",en: "Reach lvl", icon: "🎯" },
  send_specific_message:{ pt: "Frase certa",en: "Exact msg", icon: "📢" },
  react_message:        { pt: "Reagir msg", en: "React msg", icon: "👆" },
  send_emoji:           { pt: "Mandar emoji",en: "Send emoji",icon: "😄" }
};

// ─── Layout ───────────────────────────────────────────────────────────────────

const CW       = 760;
const CARD_H   = 110;
const CARD_GAP = 10;
const PAD_TOP  = 48;
const PAD_BOT  = 20;
const PAD_X    = 16;

// ─── Main export ─────────────────────────────────────────────────────────────

export async function renderMissionsGrid(
  entries: MissionRenderEntry[],
  lang:    string,
  serverCoin: { symbol: string; } | null
): Promise<Buffer> {
  const isEn = lang === "en";
  const rows  = entries.length;
  const CH    = PAD_TOP + rows * CARD_H + (rows - 1) * CARD_GAP + PAD_BOT;

  const canvas = createCanvas(CW, CH);
  const ctx    = canvas.getContext("2d");

  // ── Global background ────────────────────────────────────────────────────
  ctx.fillStyle = "#0b0b14";
  ctx.fillRect(0, 0, CW, CH);

  // Top accent bar
  ctx.fillStyle = "#5865F2";
  ctx.fillRect(0, 0, CW, 3);

  // Header
  ctx.fillStyle = "#ffffff";
  ctx.font      = font(17, "bold");
  ctx.textAlign = "left";
  ctx.fillText(isEn ? "Daily Missions" : "Missoes Diarias", PAD_X, 30);

  ctx.fillStyle = "#555577";
  ctx.font      = font(11);
  ctx.textAlign = "right";
  ctx.fillText(isEn ? `${rows} mission${rows !== 1 ? "s" : ""}` : `${rows} missao${rows !== 1 ? "es" : ""}`, CW - PAD_X, 30);

  // ── Cards ────────────────────────────────────────────────────────────────
  for (let i = 0; i < entries.length; i++) {
    const cardY = PAD_TOP + i * (CARD_H + CARD_GAP);
    await drawCard(ctx, entries[i]!, cardY, isEn, serverCoin);
  }

  return canvas.toBuffer("image/png");
}

// ─── Card renderer ────────────────────────────────────────────────────────────

async function drawCard(
  ctx:   ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  entry: MissionRenderEntry,
  y:     number,
  isEn:  boolean,
  serverCoin: { symbol: string; } | null
): Promise<void> {
  const { mission, progress, completed, claimed } = entry;
  const theme  = PLAN_THEME[mission.requiredPlan] ?? PLAN_THEME["hsbc"]!;
  const pct    = Math.min(100, Math.floor((progress / mission.target) * 100));
  const isHsbc = mission.requiredPlan === "hsbc"; // default / no special bg tint

  // ── Card background ───────────────────────────────────────────────────────
  const cardW = CW - PAD_X * 2;

  // Rounded rect fill
  roundRect(ctx, PAD_X, y, cardW, CARD_H, 10);

  if (isHsbc) {
    // Neutral dark card for free missions
    ctx.fillStyle = "#141420";
  } else {
    // Tinted card matching plan color
    ctx.fillStyle = theme.bg;
  }
  ctx.fill();

  // Card border — plan accent color, dimmed for free, bright for premium
  roundRect(ctx, PAD_X, y, cardW, CARD_H, 10);
  ctx.strokeStyle = isHsbc ? "rgba(255,255,255,0.06)" : theme.accent + "55";
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // Completed glow overlay
  if (completed && !claimed) {
    roundRect(ctx, PAD_X, y, cardW, CARD_H, 10);
    ctx.fillStyle = "rgba(87,242,135,0.06)";
    ctx.fill();
  }

  // Claimed strikethrough overlay
  if (claimed) {
    roundRect(ctx, PAD_X, y, cardW, CARD_H, 10);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();
  }

  // Left accent stripe
  ctx.fillStyle = completed && !claimed ? "#57F287" : theme.accent;
  ctx.fillRect(PAD_X, y + 10, 3, CARD_H - 20);

  // ── Status icon (top-right) ──────────────────────────────────────────────
  const statusText = claimed    ? "COLETADO"
                   : completed  ? "COMPLETO"
                   : `${pct}%`;
  const statusColor = claimed    ? "#aaaaaa"
                    : completed  ? "#57F287"
                    : "#cccccc";

  ctx.fillStyle   = statusColor;
  ctx.font        = font(12, "bold");
  ctx.textAlign   = "right";
  ctx.fillText(statusText, CW - PAD_X - 12, y + 22);

  // ── Plan badge (small pill top-right below status) ───────────────────────
  if (!isHsbc) {
    const badgeText = theme.label.toUpperCase();
    const badgeW    = 60;
    const badgeX    = CW - PAD_X - 12 - badgeW;
    const badgeY    = y + 8;

    roundRect(ctx, badgeX, badgeY, badgeW, 16, 4);
    ctx.fillStyle = theme.badge;
    ctx.fill();

    ctx.fillStyle   = theme.accent;
    ctx.font        = font(9, "bold");
    ctx.textAlign   = "center";
    ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + 11);
  }

  // ── Type icon + description ───────────────────────────────────────────────
  const typeInfo  = TYPE_LABEL[mission.type];
  const typeIcon  = typeInfo?.icon ?? "📋";
  const typeLabel = typeInfo ? (isEn ? typeInfo.en : typeInfo.pt) : mission.type;
  const desc      = isEn ? mission.descriptionEn : mission.description;

  const textX = PAD_X + 20;

  ctx.fillStyle   = "#cccccc";
  ctx.font        = font(11);
  ctx.textAlign   = "left";
  ctx.fillText(`${typeLabel}`.toUpperCase(), textX, y + 22);

  ctx.fillStyle = claimed ? "#666688" : "#ffffff";
  ctx.font      = font(14, "bold");
  ctx.fillText(truncate(desc, 58), textX, y + 42);

  // ── Progress bar ──────────────────────────────────────────────────────────
  const barX  = textX;
  const barY  = y + 54;
  const barW  = cardW - 40 - 90; // leave room for reward block on the right
  const barH  = 12;
  const barR  = 6;

  // Track
  roundRect(ctx, barX, barY, barW, barH, barR);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fill();

  // Fill
  if (pct > 0) {
    const fillW = Math.max(barR * 2, (pct / 100) * barW);

    const grad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
    if (completed) {
      grad.addColorStop(0, "#57F287");
      grad.addColorStop(1, "#1ab854");
    } else {
      grad.addColorStop(0, theme.accent);
      grad.addColorStop(1, lighten(theme.accent, 40));
    }

    roundRect(ctx, barX, barY, fillW, barH, barR);
    ctx.fillStyle = grad;
    ctx.fill();

    // Glow on fill edge
    ctx.shadowColor = completed ? "#57F287" : theme.accent;
    ctx.shadowBlur  = 6;
    roundRect(ctx, barX, barY, fillW, barH, barR);
    ctx.fillStyle = "transparent";
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Progress label under bar
  ctx.fillStyle   = "#555577";
  ctx.font        = font(10);
  ctx.textAlign   = "left";
  ctx.fillText(`${progress} / ${mission.target}`, barX, barY + barH + 13);

  // ── Reward block (right side) ─────────────────────────────────────────────
  const rewX  = CW - PAD_X - 12 - 82;
  const rewY  = y + 50;

  ctx.textAlign = "right";

  const rewardParts: { text: string; color: string }[] = [];
  if (mission.xpReward > 0)    rewardParts.push({ text: `+${mission.xpReward} XP`, color: "#ffd770" });
  if (mission.coinReward > 0 && serverCoin?.symbol)  rewardParts.push({ text: `+${mission.coinReward} ${serverCoin.symbol}`, color: "#a0d8ff" });
  if (mission.itemRewardId !== null) rewardParts.push({ text: "+ Badge", color: "#cc88ff" });

  let rLineY = rewY;
  for (const part of rewardParts) {
    ctx.fillStyle = claimed ? "#555566" : part.color;
    ctx.font      = font(11, "bold");
    ctx.fillText(part.text, CW - PAD_X - 12, rLineY);
    rLineY += 16;
  }

  // Seasonal badge
  if (mission.seasonal && mission.season !== undefined) {
    const seasonEmojis: Record<string, string> = {
      halloween: "🎃",
      christmas: "🎄",
      carnival:  "🎉",
      easter:    "🐣",
      summer:    "☀"
    };
    ctx.fillStyle   = "#ffcc44";
    ctx.font        = font(10);
    ctx.textAlign   = "right";
    ctx.fillText(
      `${seasonEmojis[mission.season] ?? "🌟"} ${mission.season.toUpperCase()}`,
      CW - PAD_X - 12,
      y + CARD_H - 10
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundRect(
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

function lighten(hex: string, amount = 40): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + amount);
  const g = Math.min(255, ((n >> 8)  & 0xff) + amount);
  const b = Math.min(255,  (n        & 0xff) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}