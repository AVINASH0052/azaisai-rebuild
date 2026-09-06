import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as { __azaiDb?: ReturnType<typeof drizzle<typeof schema>> };

export function createDb() {
  if (!env.DATABASE_URL) return null;
  if (!globalForDb.__azaiDb) {
    globalForDb.__azaiDb = drizzle(postgres(env.DATABASE_URL, { prepare: false }), {
      schema,
    });
  }
  return globalForDb.__azaiDb;
}

export function requireDb() {
  const db = createDb();
  if (!db) throw new Error("DATABASE_URL is not configured");
  return db;
}
