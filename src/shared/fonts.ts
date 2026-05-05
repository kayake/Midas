import { GlobalFonts } from "@napi-rs/canvas";
import { existsSync, mkdirSync } from "fs";
import { join }                  from "path";
import https                     from "https";
import fs                        from "fs";

const FONTS_DIR = join(process.cwd(), "assets", "fonts");

// Fontes usadas no canvas — hospedadas no GitHub (Bunny Fonts CDN)
// Inter: suporte completo a Latin/acentos
// NotoEmoji: suporte a emojis como fallback
const FONT_SOURCES = [
  {
    name:   "Inter-Regular",
    family: "Inter",
    file:   "Inter-Regular.ttf",
    url:    "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bslnt%2Cwght%5D.ttf"
  },
  {
    name:   "Inter-Bold",
    family: "Inter",
    file:   "Inter-Bold.ttf",
    // Subconjunto bold do Inter via bunny fonts
    url:    "https://fonts.bunny.net/inter/files/inter-latin-700-normal.woff2"
  },
  {
    name:   "NotoEmoji",
    family: "NotoEmoji",
    file:   "NotoEmoji.ttf",
    url:    "https://github.com/google/fonts/raw/main/ofl/notoemoji/NotoEmoji%5Bwght%5D.ttf"
  }
] as const;

async function downloadFont(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get  = (u: string): void => {
      https.get(u, res => {
        // Follow redirects
        if (res.statusCode === 301 || res.statusCode === 302) {
          get(res.headers.location!);
          return;
        }
        res.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
      }).on("error", reject);
    };
    get(url);
  });
}

let loaded = false;

/**
 * Call once at bot startup. Downloads fonts if missing, then registers them
 * with GlobalFonts so every canvas created afterwards can use them.
 */
export async function loadFonts(): Promise<void> {
  if (loaded) return;

  if (!existsSync(FONTS_DIR)) {
    mkdirSync(FONTS_DIR, { recursive: true });
  }

  for (const font of FONT_SOURCES) {
    const dest = join(FONTS_DIR, font.file);

    if (!existsSync(dest)) {
      console.log(`[Fonts] Baixando ${font.name}...`);
      try {
        await downloadFont(font.url, dest);
        console.log(`[Fonts] ${font.name} OK`);
      } catch (err) {
        console.error(`[Fonts] Falha ao baixar ${font.name}:`, err);
        continue;
      }
    }

    GlobalFonts.registerFromPath(dest, font.family);
  }

  loaded = true;
  console.log("[Fonts] Todas as fontes registradas.");
}

/**
 * Returns a font stack string safe for canvas ctx.font.
 * Falls back through Inter → NotoEmoji → sans-serif.
 */
export function font(size: number, weight: "normal" | "bold" | "italic bold" = "normal"): string {
  return `${weight} ${size}px Inter, NotoEmoji, sans-serif`;
}