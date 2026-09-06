import { pgEnum } from "drizzle-orm/pg-core";

export const planEnum = pgEnum("plan_enum", [
  "free",
  "starter",
  "pro",
  "business",
]);

export const roleEnum = pgEnum("role_enum", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const ledgerReasonEnum = pgEnum("ledger_reason", [
  "signup_grant",
  "referral_grant",
  "promo_grant",
  "subscription_grant",
  "topup_purchase",
  "generation_debit",
  "generation_refund",
  "expiry",
  "admin_adjustment",
  "chargeback",
]);

export const grantKindEnum = pgEnum("grant_kind", [
  "signup",
  "subscription",
  "topup",
  "promo",
  "referral",
]);

export const genKindEnum = pgEnum("gen_kind", ["video", "image"]);

export const genStatusEnum = pgEnum("gen_status", [
  "queued",
  "submitted",
  "processing",
  "downloading",
  "ready",
  "failed",
  "cancelled",
]);

export const visEnum = pgEnum("vis_enum", ["private", "unlisted", "public"]);

export const assetRoleEnum = pgEnum("asset_role", [
  "output",
  "thumbnail",
  "preview",
  "source",
  "watermarked",
]);

export const subStatusEnum = pgEnum("sub_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
]);

export const actorTypeEnum = pgEnum("actor_type", [
  "user",
  "system",
  "admin",
  "api_key",
]);

export const adminRoleEnum = pgEnum("admin_role", [
  "support",
  "operator",
  "superadmin",
]);

export const workspaceStateEnum = pgEnum("workspace_state", [
  "active",
  "throttled",
  "suspended",
  "read_only",
]);
