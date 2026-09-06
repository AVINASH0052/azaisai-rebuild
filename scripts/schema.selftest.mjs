#!/usr/bin/env node
import { readFileSync } from "node:fs";

const sql =
  readFileSync("drizzle/0000_init.sql", "utf8") +
  readFileSync("drizzle/0001_admin_policy.sql", "utf8") +
  readFileSync("supabase/policies/rls.sql", "utf8");

const needed = [
  "workspaces",
  "workspace_members",
  "profiles",
  "credit_ledger",
  "credit_grants",
  "generations",
  "generation_assets",
  "share_links",
  "subscriptions",
  "audit_events",
  "api_keys",
  "job_outbox",
  "analytics_events",
  "platform_admins",
  "plan_policies",
  "workspace_policies",
  "platform_settings",
  "admin_actions",
  "current_workspace_ids",
  "handle_new_user",
  "forbid_mutation",
];

const missing = needed.filter((name) => !sql.includes(name));
if (missing.length) {
  console.error("schema self-test missing", missing.join(", "));
  process.exit(1);
}
if (!sql.includes("signup_grant") || !sql.includes("'signup', 5")) {
  console.error("welcome grant of 5 credits missing");
  process.exit(1);
}
console.log("schema self-test ok");
