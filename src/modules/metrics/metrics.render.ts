import { createCanvas } from "@napi-rs/canvas";
import { font }         from "../../shared/fonts";

export interface CommandStat { command: string; useCount: number }

export function renderCommandsChart(commands: CommandStat[]): Buffer {
  const BAR_H   = 28;
  const GAP     = 8;
  const PAD_X   = 180;  // left label area
  const PAD_R   = 60;   // right count area
  const PAD_T   = 48;
  const PAD_B   = 24;
  const PLOT_W  = 500;

  const rows = commands.slice(0, 10);
  const CW   = PAD_X + PLOT_W + PAD_R + 20;
  const CH   = PAD_T + rows.length * (BAR_H + GAP) + PAD_B;

  const canvas = createCanvas(CW, CH);
  const ctx    = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#0b0b14";
  ctx.fillRect(0, 0, CW, CH);
  ctx.fillStyle = "#5865F2";
  ctx.fillRect(0, 0, CW, 3);

  // Header
  ctx.fillStyle = "#ffffff";
  ctx.font      = font(16, "bold");
  ctx.textAlign = "left";
  ctx.fillText("Top Commands", 16, 30);

  const maxCount = Math.max(...rows.map(r => r.useCount), 1);

  rows.forEach((cmd, i) => {
    const y      = PAD_T + i * (BAR_H + GAP);
    const fillW  = Math.max(4, (cmd.useCount / maxCount) * PLOT_W);

    // Command label
    ctx.fillStyle = "#aaaacc";
    ctx.font      = font(12);
    ctx.textAlign = "right";
    ctx.fillText(`/${cmd.command}`, PAD_X - 8, y + BAR_H / 2 + 5);

    // Bar track
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.roundRect(PAD_X, y, PLOT_W, BAR_H, 5);
    ctx.fill();

    // Bar fill with gradient
    const hue  = Math.floor((i / rows.length) * 200 + 200); // blue → purple range
    const grad = ctx.createLinearGradient(PAD_X, 0, PAD_X + fillW, 0);
    grad.addColorStop(0, `hsl(${hue},80%,55%)`);
    grad.addColorStop(1, `hsl(${hue + 30},80%,65%)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(PAD_X, y, fillW, BAR_H, 5);
    ctx.fill();

    // Count label
    ctx.fillStyle = "#ffffff";
    ctx.font      = font(12, "bold");
    ctx.textAlign = "left";
    ctx.fillText(cmd.useCount.toLocaleString(), PAD_X + fillW + 8, y + BAR_H / 2 + 5);
  });

  return canvas.toBuffer("image/png");
}