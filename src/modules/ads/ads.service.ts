import { InteractionReplyOptions, MessageFlags } from "discord.js";

import { loadAds } from "./ads.loader";

const PORCENTAGE_CHANCE = 0.1; // 10% chance to show an ad on eligible interactions

export class AdsService {
  private lastAdShown: Map<string, number> = new Map<string, number>();
  
  public async sendAds(): Promise<InteractionReplyOptions | undefined> {
    const ads = await loadAds();
    return {
      ...ads[Math.floor(Math.random() * ads.length)].options,
      flags: MessageFlags.Ephemeral
    }
  }

  public shouldSendAd(guildId: string, cooldown: number = 10 * 60 * 1000): boolean {
    if (Math.random() > PORCENTAGE_CHANCE) {
      return false;
    }

    const lastShown = this.lastAdShown.get(guildId);
    if (lastShown === undefined) {
      this.lastAdShown.set(guildId, Date.now());
      return true;
    }

    const now = Date.now();
    if ((now - lastShown) >= cooldown) {
      this.lastAdShown.set(guildId, now);
      return true;
    }

    return false;
  }
}

export const adsService = new AdsService();