import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { guilds, guildMembers } from "../../db/schema/index";

export interface XPValidationConfig {
  minCharacters: number;
  cooldownSeconds: number;
  preventRepetition: boolean;
}

const DEFAULT_CONFIG: XPValidationConfig = {
  minCharacters: 3,
  cooldownSeconds: 60,
  preventRepetition: true
};

// In-memory cooldown tracker: "userId:guildId" -> { timestamp, lastMessage }
const cooldowns = new Map<string, { timestamp: number; lastMessage: string }>();

export async function getXPValidationConfig(guildId: string): Promise<XPValidationConfig> {
  const [guild] = await db
    .select()
    .from(guilds)
    .where(eq(guilds.id, guildId));

  // TODO: Store these in a new xp_config table
  // For now, return defaults
  return DEFAULT_CONFIG;
}

export async function validateMessageForXP(
  userId: string,
  guildId: string,
  messageContent: string
): Promise<{ valid: boolean; reason?: string }> {
  const config = await getXPValidationConfig(guildId);
  const key = `${userId}:${guildId}`;
  const now = Date.now();
  const cooldownEntry = cooldowns.get(key);

  // Check cooldown
  if (cooldownEntry !== undefined) {
    const elapsedSeconds = (now - cooldownEntry.timestamp) / 1000;
    if (elapsedSeconds < config.cooldownSeconds) {
      return { valid: false, reason: "cooldown" };
    }
  }

  // Check minimum characters
  const cleanContent = messageContent.trim();
  if (cleanContent.length < config.minCharacters) {
    return { valid: false, reason: "min_length" };
  }

  // Check for repetition
  if (config.preventRepetition && cooldownEntry !== undefined) {
    const isSame = cleanContent.toLowerCase() === cooldownEntry.lastMessage.toLowerCase();
    if (isSame) {
      return { valid: false, reason: "repetition" };
    }
  }

  // Update cooldown
  cooldowns.set(key, { timestamp: now, lastMessage: cleanContent });

  return { valid: true };
}

export async function setXPValidationConfig(
  guildId: string,
  config: Partial<XPValidationConfig>
): Promise<void> {
  // TODO: Implement when xp_config table is created
  // For now, this is a placeholder
  console.log(`[XP Config] Setting for guild ${guildId}:`, config);
}
