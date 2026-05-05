// src/modules/missions/mission.types.ts

export type MissionType =
  | "send_messages"
  | "voice_minutes"
  | "buy_item"
  | "gain_xp"
  | "reach_level"
  | "send_emoji"
  | "react_message"
  | "send_specific_message";

export interface SpecificMessageConfig {
  message: string;
  messageEn?: string;
  caseSensitive?: boolean;
}

export interface Mission {
  id:                 number;
  description:        string;
  descriptionEn:      string;
  type:               MissionType;
  target:             number;
  xpReward:           number;
  coinReward:         number;
  itemRewardId:       number | null;
  requiredPlan:       string;      // "hsbc" | "barclays" | "deutsche" | "ubs"
  active:             boolean;
  seasonal:           boolean;
  season?:            string;      // "halloween" | "christmas" etc — only if seasonal
  specificConfig?:    SpecificMessageConfig;  // For send_specific_message and react_message
}
