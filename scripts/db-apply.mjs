#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const files = [
  resolve("drizzle/0000_init.sql"),
  resolve("supabase/policies/rls.sql"),
];

for (const file of files) {
  const r = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-f", file], {
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("applied", files.length, "sql files");
