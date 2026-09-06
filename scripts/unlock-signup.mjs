#!/usr/bin/env node
// Turn off confirm-email (built-in mailer is rate-limited) and put the
// service-role key on Vercel so /api/auth/signup can create confirmed users.
// Token from SUPABASE_ACCESS_TOKEN or `supabase login`. Never prints secrets.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const REF = "wdlqnsxrfzvgyhqixijx";
const API = "https://api.supabase.com/v1";

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

function vercelSet(name, value) {
  for (const env of ["production", "preview", "development"]) {
    const r = spawnSync(
      "vercel",
      ["env", "add", name, env, "--value", value, "--yes", "--force", "--sensitive"],
      { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" },
    );
    if (r.status !== 0) {
      console.error(`vercel env ${name} ${env} failed`);
      process.exit(r.status ?? 1);
    }
  }
  console.log("set", name, "on Vercel (value hidden)");
}

async function main() {
  await api("PATCH", `/projects/${REF}/config/auth`, {
    mailer_autoconfirm: true,
  });
  console.log("auth: confirm email off");

  const keys = await api("GET", `/projects/${REF}/api-keys`);
  const list = Array.isArray(keys) ? keys : keys?.api_keys || [];
  const service = list.find(
    (k) =>
      k.name === "service_role" ||
      k.id === "service_role" ||
      k.type === "secret" ||
      k.name === "service_role key",
  );
  const value = service?.api_key || service?.key || service?.secret;
  if (value) vercelSet("SUPABASE_SERVICE_ROLE_KEY", value);
  else console.log("service_role key not returned; skip Vercel secret");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
