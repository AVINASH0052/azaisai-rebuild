import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";

export function createDb() {
  if (!env.DATABASE_URL) return null;
  return drizzle(postgres(env.DATABASE_URL, { prepare: false }));
}
