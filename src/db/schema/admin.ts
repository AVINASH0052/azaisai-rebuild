import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { adminRoleEnum, planEnum, workspaceStateEnum } from "./enums";
import { workspaces } from "./workspaces";

export const platformAdmins = pgTable("platform_admins", {
  userId: uuid("user_id").primaryKey(),
  role: adminRoleEnum("role").notNull(),
  grantedBy: uuid("granted_by"),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  demoReadonly: boolean("demo_readonly").notNull().default(false),
});

export const planPolicies = pgTable("plan_policies", {
  plan: planEnum("plan").primaryKey(),
  limits: jsonb("limits").$type<Record<string, unknown>>().notNull(),
  updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspacePolicies = pgTable("workspace_policies", {
  workspaceId: uuid("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  overrides: jsonb("overrides").$type<Record<string, unknown>>().notNull().default({}),
  state: workspaceStateEnum("state").notNull().default("active"),
  reason: text("reason").notNull(),
  setBy: uuid("set_by"),
  setAt: timestamp("set_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const platformSettings = pgTable("platform_settings", {
  id: text("id").primaryKey().default("default"),
  clamps: jsonb("clamps").$type<Record<string, unknown>>().notNull().default({}),
  providerMode: text("provider_mode").notNull().default("mock"),
  dailySpendCapCents: integer("daily_spend_cap_cents"),
  signupEnabled: boolean("signup_enabled").notNull().default(true),
  maintenanceMessage: text("maintenance_message"),
  updatedBy: uuid("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminActions = pgTable("admin_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id"),
  actorType: text("actor_type").notNull(),
  action: text("action").notNull(),
  subjectType: text("subject_type"),
  subjectId: text("subject_id"),
  before: jsonb("before").$type<Record<string, unknown>>(),
  after: jsonb("after").$type<Record<string, unknown>>(),
  reason: text("reason").notNull(),
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const moderationFlags = pgTable("moderation_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  generationId: uuid("generation_id").notNull(),
  source: text("source").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"),
  reviewedBy: uuid("reviewed_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
