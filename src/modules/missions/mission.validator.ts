import { getMissionsForUser } from "./mission.loader";
import { getUserPlan } from "../subscription/subscription.service";
import type { Mission } from "./mission.types";
import { get } from "http";

/**
 * Check if a message matches a specific mission's requirement
 * Supports:
 * - Simple strings: "feliz natal"
 * - Multiple options: "incrível|ótimo|legal"
 * - Case-sensitive or insensitive matching
 */
export function checkMessageAgainstMission(
  messageContent: string,
  mission: Mission
): boolean {
  if (mission.type !== "send_specific_message") return false;
  if (!mission.specificConfig) return false;

  const { message, messageEn, caseSensitive = false } = mission.specificConfig;

  const content = caseSensitive ? messageContent : messageContent.toLowerCase();
  
  // Build list of target patterns from both message and messageEn
  const patterns: string[] = [];
  if (message) patterns.push(...message.split("|").map(p => p.trim()));
  if (messageEn) patterns.push(...messageEn.split("|").map(p => p.trim()));

  // Convert patterns to lowercase if case-insensitive
  const targetPatterns = caseSensitive ? patterns : patterns.map(p => p.toLowerCase());

  // Check if message contains ANY of the patterns
  return targetPatterns.some(pattern => content.includes(pattern));
}

/**
 * Get all send_specific_message missions a user has access to
 */
export async function getSpecificMessageMissionsForUser(
  userId: string,
  guildId: string,
  season?: string
): Promise<Mission[]> {
  const missions = await getMissionsForUser(
    // TODO: Get actual plan, for now use "hsbc"
    await getUserPlan(userId).then(plan => plan || "hsbc"),
    season
  );

  return missions.filter(m => m.type === "send_specific_message");
}

/**
 * Validate message against all specific message missions
 * Returns array of mission IDs that match
 */
export async function validateMessageAgainstMissions(
  messageContent: string,
  userId: string,
  guildId: string,
  season?: string
): Promise<number[]> {
  const missions = await getSpecificMessageMissionsForUser(userId, guildId, season);
  
  const matches: number[] = [];
  for (const mission of missions) {
    if (checkMessageAgainstMission(messageContent, mission)) {
      matches.push(mission.id);
    }
  }

  return matches;
}
