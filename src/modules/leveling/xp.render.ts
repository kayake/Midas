import { createCanvas } from "@napi-rs/canvas";
import type { XPAlgorithm } from "./xp.config";
import { buildProjection } from "./xp.config";

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 300;
const PADDING = { top: 40, right: 30, bottom: 40, left: 50 };

export function renderXPProjection(maxLevel: number, algo: XPAlgorithm): Buffer {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#0d0f14";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const projection = buildProjection(maxLevel, algo);
  if (projection.length === 0) {
    ctx.fillStyle = "#888";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No projection data", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    return canvas.toBuffer("image/png");
  }

  const plotW = CANVAS_WIDTH - PADDING.left - PADDING.right;
  const plotH = CANVAS_HEIGHT - PADDING.top - PADDING.bottom;

  // Find min/max XP
  const xpValues = projection.map(p => p.totalXP);
  const minXP = Math.min(...xpValues);
  const maxXP = Math.max(...xpValues);
  const xpRange = maxXP - minXP || 1;

  const toX = (level: number): number => PADDING.left + ((level - 1) / (maxLevel - 1)) * plotW;
  const toY = (xp: number): number => PADDING.top + plotH - ((xp - minXP) / xpRange) * plotH;

  // Grid lines
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = PADDING.top + (i / 5) * plotH;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, y);
    ctx.lineTo(CANVAS_WIDTH - PADDING.right, y);
    ctx.stroke();
  }

  // Axis labels - Y axis (XP)
  ctx.fillStyle = "#888";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  for (let i = 0; i <= 5; i++) {
    const xp = minXP + (i / 5) * xpRange;
    const y = PADDING.top + (1 - i / 5) * plotH;
    ctx.fillText(Math.round(xp).toLocaleString(), PADDING.left - 8, y + 4);
  }

  // Axis labels - X axis (Level)
  ctx.textAlign = "center";
  for (let i = 0; i <= maxLevel; i += Math.max(1, Math.floor(maxLevel / 5))) {
    const x = toX(i);
    ctx.fillText(i.toString(), x, CANVAS_HEIGHT - 8);
  }

  // Axis titles
  ctx.fillStyle = "#ccc";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.save();
  ctx.translate(15, CANVAS_HEIGHT / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Total XP", 0, 0);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.fillText("Level", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 5);

  // Draw curve
  ctx.strokeStyle = "#0018a8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(toX(1), toY(projection[0]!.totalXP));

  for (let i = 1; i < projection.length; i++) {
    const p = projection[i]!;
    const x = toX(p.level);
    const y = toY(p.totalXP);

    // Smooth curve using quadratic bezier
    const prevX = toX(projection[i - 1]!.level);
    const prevY = toY(projection[i - 1]!.totalXP);
    const cp1X = (prevX + x) / 2;
    const cp1Y = prevY;

    ctx.quadraticCurveTo(cp1X, cp1Y, x, y);
  }
  ctx.stroke();

  // Fill area under curve
  const grad = ctx.createLinearGradient(0, PADDING.top, 0, PADDING.top + plotH);
  grad.addColorStop(0, "rgba(0, 24, 168, 0.3)");
  grad.addColorStop(1, "rgba(0, 24, 168, 0.05)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(toX(1), toY(projection[0]!.totalXP));
  for (let i = 1; i < projection.length; i++) {
    const p = projection[i]!;
    ctx.lineTo(toX(p.level), toY(p.totalXP));
  }
  ctx.lineTo(toX(projection[projection.length - 1]!.level), PADDING.top + plotH);
  ctx.lineTo(toX(1), PADDING.top + plotH);
  ctx.closePath();
  ctx.fill();

  // Border
  ctx.strokeStyle = "#0018a8";
  ctx.lineWidth = 1;
  ctx.strokeRect(PADDING.left, PADDING.top, plotW, plotH);

  return canvas.toBuffer("image/png");
}
