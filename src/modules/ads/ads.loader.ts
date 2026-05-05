// src/modules/ads/ads.loader.ts
import { readFile } from "fs/promises";
import { resolve }  from "path";

export interface Ad {
  id:            number;
  active:        boolean;
  intervalHours: number;
  sponsorName:   string | null;
  options:       Record<string, unknown>; // discord.js MessageCreateOptions
}

const ADS_PATH = resolve("src/data/ads.json");

export async function loadAds(): Promise<Ad[]> {
  const raw  = await readFile(ADS_PATH, "utf-8");
  const data = JSON.parse(raw) as Ad[];
  return data.filter(a => a.active);
}

export async function reloadAds(): Promise<Ad[]> {
  return loadAds();
}
