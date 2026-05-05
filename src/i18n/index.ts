import pt from "./pt.json";
import en from "./en.json";
import { eq } from "drizzle-orm";

const locales = { pt, en } as const;
export type Lang = keyof typeof locales;

export function t(key: string, lang: string = "pt"): any {
  const locale = locales[(lang as Lang)] ?? locales.pt;
  return (locale as Record<string, any>)[key] ?? key;
}

export async function getUserLang(userId: string): Promise<Lang> {
  const { db }    = await import("../db/client.js");
  const { users } = await import("../db/schema/index.js");

  // Ensure user exists
  await db.insert(users).values({ id: userId }).onConflictDoNothing();

  const [user] = await db
    .select({ language: users.language })
    .from(users)
    .where(eq(users.id, userId));

  return (user?.language as Lang) ?? "pt";
}
