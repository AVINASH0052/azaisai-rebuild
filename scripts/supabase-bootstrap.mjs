#!/usr/bin/env node
// Configure Auth redirects + email OTP, then apply schema via Management API.
// Token from SUPABASE_ACCESS_TOKEN or `supabase login`. Never prints secrets.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REF = "wdlqnsxrfzvgyhqixijx";
const API = "https://api.supabase.com/v1";
const SITE = "https://azaisai-rebuild.vercel.app";
const ALLOW = [
  `${SITE}`,
  `${SITE}/**`,
  `${SITE}/auth/callback`,
  "http://localhost:3000",
  "http://localhost:3000/**",
  "http://localhost:3000/auth/callback",
].join(",");

function token() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  const p = join(homedir(), ".supabase", "access-token");
  if (existsSync(p)) return readFileSync(p, "utf8").trim();
  return "";
}

async function api(method, path, body) {
  const t = token();
  if (!t) {
    console.error("Not logged in. Run: supabase login");
    process.exit(1);
  }
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.message || data?.error || text.slice(0, 400);
    throw new Error(`${method} ${path} ${res.status}: ${msg}`);
  }
  return data;
}

async function applySql(file) {
  const query = readFileSync(file, "utf8");
  await api("POST", `/projects/${REF}/database/query`, { query });
  console.log("applied", file);
}

function vercelSet(name, value) {
  const r = spawnSync(
    "vercel",
    [
      "env",
      "add",
      name,
      "production",
      "--value",
      value,
      "--yes",
      "--force",
      "--sensitive",
    ],
    { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
  );
  const preview = spawnSync(
    "vercel",
    [
      "env",
      "add",
      name,
      "preview",
      "--value",
      value,
      "--yes",
      "--force",
      "--sensitive",
    ],
    { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
  );
  if (r.status !== 0) {
    console.error(`vercel env ${name} production failed`);
    process.exit(r.status ?? 1);
  }
  if (preview.status !== 0) {
    console.error(`vercel env ${name} preview failed`);
    process.exit(preview.status ?? 1);
  }
  console.log("set", name, "on Vercel (value hidden)");
}

async function main() {
  await api("PATCH", `/projects/${REF}/config/auth`, {
    site_url: SITE,
    uri_allow_list: ALLOW,
    external_email_enabled: true,
    mailer_autoconfirm: false,
  });
  console.log("auth: email on, OTP confirm, redirects set");

  await applySql("drizzle/0000_init.sql");
  await applySql("supabase/policies/rls.sql");

  const keys = await api("GET", `/projects/${REF}/api-keys`);
  const list = Array.isArray(keys) ? keys : keys?.api_keys || [];
  const service = list.find((k) => k.name === "service_role" || k.id === "service_role");
  const value = service?.api_key || service?.key || service?.secret;
  if (value) vercelSet("SUPABASE_SERVICE_ROLE_KEY", value);
  else console.log("service_role key not returned; skip Vercel secret");

  const tables = await api("POST", `/projects/${REF}/database/query`, {
    query: `select tablename from pg_tables where schemaname='public' and tablename in ('workspaces','credit_ledger','generations') order by 1`,
  });
  console.log("tables", JSON.stringify(tables));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
