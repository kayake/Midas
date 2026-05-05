import "dotenv/config";

import { loadFonts } from "./shared/fonts";

// Jobs
import "./jobs/cleanExpiredSubscriptions";

// Shop rotation
import "./modules/shop/shop.rotate";

import { startBot } from "./bot/client";

async function main(): Promise<void> {
  // Load fonts before anything that uses canvas
  await loadFonts();

  await startBot();
}

void main();