import { readFile } from "fs/promises";
import { resolve }   from "path";

import { planMeetsRequirement } from "../../shared/plans";

import type { Mission } from "./mission.types";

const MISSIONS_PATH          = resolve("src/data/missions.json");
const SEASONAL_MISSIONS_PATH = resolve("src/data/missions.seasonal.json");

export async function loadMissions(): Promise<Mission[]> {
  const raw  = await readFile(MISSIONS_PATH, "utf-8");
  const data = JSON.parse(raw) as Mission[];
  return data.filter(m => m.active && !m.seasonal);
}

export async function loadSeasonalMissions(season: string): Promise<Mission[]> {
  const raw  = await readFile(SEASONAL_MISSIONS_PATH, "utf-8");
  const data = JSON.parse(raw) as Mission[];
  return data.filter(m => m.active && m.seasonal && m.season === season);
}

export async function getMissionsForUser(
  userPlan:       string,
  activeSeason?:  string
): Promise<Mission[]> {
  const regular  = await loadMissions();
  const seasonal = activeSeason !== undefined
    ? await loadSeasonalMissions(activeSeason)
    : [];

  return [...regular, ...seasonal].filter(m =>
    planMeetsRequirement(userPlan, m.requiredPlan)
  );
}

export async function getMissionById(id: number): Promise<Mission | null> {
  const [regular, seasonal] = await Promise.all([
    loadMissions(),
    readFile(SEASONAL_MISSIONS_PATH, "utf-8")
      .then(r => (JSON.parse(r) as Mission[]).filter(m => m.active))
  ]);

  return [...regular, ...seasonal].find(m => m.id === id) ?? null;
}
