export const PLANS = {
  hsbc: {
    id:                   "hsbc",
    name:                 "HSBC",
    label:                "Free",
    color:                "#DB0011" as const,
    multiplier:           1,
    hasAd:               true,
    shopSlotBonus:        0,
    boostBonusMax:        0,
    boostBonusStep:       0,
    missionResets:        0,
    // Base daily mission slots + 1 plan bonus = 3 + 0 = 3 total
    missionSlotsBonus:    0,
    extraMissionPackCost: 150, // BankCoins to buy +3 extra missions
    canCreateCurrency:    false,
    canSetXPAlgorithm:    false,
    canOverrideInflation: false,
    maxExchangePairs:     0
  },
  barclays: {
    id:                   "barclays",
    name:                 "Barclays",
    label:                "Basic",
    color:                "#00AEEF" as const,
    multiplier:           1.5,
    hasAd:              false,
    shopSlotBonus:        0,
    boostBonusMax:        1.5,
    boostBonusStep:       0.25,
    missionResets:        1,
    // 3 base + 1 plan bonus = 4 total
    missionSlotsBonus:    1,
    extraMissionPackCost: 100,
    canCreateCurrency:    true,
    canSetXPAlgorithm:    false,
    canOverrideInflation: false,
    maxExchangePairs:     2
  },
  deutsche: {
    id:                   "deutsche",
    name:                 "Deutsche",
    label:                "Pro",
    color:                "#0018A8" as const,
    multiplier:           2,
    hasAd:             false,
    shopSlotBonus:        1,
    boostBonusMax:        2,
    boostBonusStep:       0.25,
    missionResets:        3,
    // 3 base + 1 plan bonus = 4 total
    missionSlotsBonus:    1,
    extraMissionPackCost: 75,
    canCreateCurrency:    true,
    canSetXPAlgorithm:    true,
    canOverrideInflation: false,
    maxExchangePairs:     5
  },
  ubs: {
    id:                   "ubs",
    name:                 "UBS",
    label:                "Elite",
    color:                "#E30613" as const,
    multiplier:           3,
    hasAd:            false,
    shopSlotBonus:        2,
    boostBonusMax:        3,
    boostBonusStep:       0.5,
    missionResets:        -1,
    // 3 base + 1 plan bonus = 4 total
    missionSlotsBonus:    1,
    extraMissionPackCost: 50,
    canCreateCurrency:    true,
    canSetXPAlgorithm:    true,
    canOverrideInflation: true,
    maxExchangePairs:     -1
  }
} as const;

export type PlanId = keyof typeof PLANS;
export type Plan   = (typeof PLANS)[PlanId];

export function getPlan(id: string): Plan {
  return PLANS[id as PlanId] ?? PLANS.hsbc;
}

export function planOrder(id: string): number {
  const order: Record<string, number> = { hsbc: 0, barclays: 1, deutsche: 2, ubs: 3 };
  return order[id] ?? 0;
}

export function planMeetsRequirement(userPlan: string, requiredPlan: string): boolean {
  return planOrder(userPlan) >= planOrder(requiredPlan);
}
