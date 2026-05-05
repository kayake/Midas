import { XP } from "../../shared/constants";

export const XP_PER_ACTION = {
  message: XP.PER_MESSAGE,
  voice:   XP.PER_VOICE_MINUTE,
  mission: 0,
  daily:   XP.PER_DAILY
} as const;

export type XPSource = keyof typeof XP_PER_ACTION;

export interface XPAlgorithm {
  base:       number;
  exponent:   number;
  multiplier: number;
}

// XP needed to go from level N to N+1 (MEE6-style by default)
export function xpForLevel(level: number, algo?: XPAlgorithm): number {
  if (algo !== undefined) {
    return Math.floor(algo.base * Math.pow(level, algo.exponent) * algo.multiplier);
  }
  return 5 * level * level + 50 * level + 100;
}

// Total XP accumulated to reach level N
export function totalXPForLevel(level: number, algo?: XPAlgorithm): number {
  let total = 0;
  for (let i = 1; i < level; i++) total += xpForLevel(i, algo);
  return total;
}

// Calculate level from total XP
export function calcLevel(totalXP: number, algo?: XPAlgorithm): number {
  let level = 1;
  while (totalXPForLevel(level + 1, algo) <= totalXP) level++;
  return level;
}

// Progress within current level
export function levelProgress(
  totalXP: number,
  algo?:   XPAlgorithm
): { current: number; needed: number; percentage: number } {
  const level   = calcLevel(totalXP, algo);
  const current = totalXP - totalXPForLevel(level, algo);
  const needed  = xpForLevel(level, algo);
  return {
    current,
    needed,
    percentage: Math.floor((current / needed) * 100)
  };
}

// XP projection for graph — returns XP thresholds for levels 1..maxLevel
export function buildProjection(
  maxLevel: number,
  algo?:    XPAlgorithm
): { level: number; totalXP: number }[] {
  return Array.from({ length: maxLevel }, (_, i) => {
    const level = i + 1;
    return { level, totalXP: totalXPForLevel(level, algo) };
  });
}

export function applyMultiplier(amount: number, multiplier: number): number {
  return Math.floor(amount * multiplier);
}
