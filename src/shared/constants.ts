export const CENTRAL_CURRENCY = {
  name:   "BankCoin",
  symbol: "🪙",
  id:     "central"
} as const;

export const SHOP = {
  SLOTS_BASE:      4,
  ROTATE_HOUR:     22,
  DURATION_HOURS:  10,
  RARITY_WEIGHTS: {
    common:    60,
    rare:      25,
    epic:      12,
    legendary:  3
  }
} as const;

export const XP = {
  COOLDOWN_SECONDS: 60,
  PER_MESSAGE:      15,
  PER_VOICE_MINUTE: 10,
  PER_DAILY:        50
} as const;

// Inflation thresholds (supply-based automatic calculation)
export const INFLATION = {
  // supply < LOW_SUPPLY → deflation (negative rate)
  LOW_SUPPLY:    1_000,
  // supply > HIGH_SUPPLY → high inflation
  HIGH_SUPPLY:   1_000_000,
  // base rate applied at neutral supply
  BASE_RATE:     0.02,
  // max auto rate (20%)
  MAX_AUTO_RATE: 0.20,
  // min auto rate (-5% deflation)
  MIN_AUTO_RATE: -0.05,
  // how often the bot recalculates (hours)
  RECALC_HOURS:  24
} as const;

export const BOT_TEAM_IDS: string[] = (process.env.BOT_TEAM_IDS ?? "")
  .split(",")
  .map(id => id.trim())
  .filter(Boolean);

export const BOT_OWNER_ID = process.env.BOT_OWNER_ID ?? "";
