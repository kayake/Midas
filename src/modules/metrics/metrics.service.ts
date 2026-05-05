import { desc } from "drizzle-orm";
import os from "os";

import { db } from "../../db/client";
import { commandMetrics } from "../../db/schema/index";

export function getCpuUsage(): number {
  const cpus  = os.cpus();
  let idle    = 0;
  let total   = 0;

  for (const cpu of cpus) {
    for (const type of Object.values(cpu.times)) {
      total += type;
    }
    idle += cpu.times.idle;
  }

  return parseFloat(((1 - idle / total) * 100).toFixed(2));
}

export function getMemoryUsage(): { used: number; total: number; percentage: number } {
  const free  = os.freemem() - process.memoryUsage().rss;
  const used  = process.memoryUsage().rss;
  return {
    used:       Math.round(used / 1024 / 1024),
    total:      Math.round(free / 1024 / 1024),
    percentage: parseFloat(((used / free) * 100).toFixed(2))
  };
}

export async function getTopCommands(
  limit = 10
): Promise<{ command: string; useCount: number }[]> {
  return db
    .select({ command: commandMetrics.command, useCount: commandMetrics.useCount })
    .from(commandMetrics)
    .orderBy(desc(commandMetrics.useCount))
    .limit(limit);
}

export async function getLeastUsedCommands(
  limit = 10
): Promise<{ command: string; useCount: number }[]> {
  return db
    .select({ command: commandMetrics.command, useCount: commandMetrics.useCount })
    .from(commandMetrics)
    .orderBy(commandMetrics.useCount)
    .limit(limit);
}
