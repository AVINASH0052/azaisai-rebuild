import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { assetRoleEnum, genKindEnum, genStatusEnum, visEnum } from "./enums";
import { workspaces } from "./workspaces";

export const generations = pgTable(
  "generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id").notNull(),
    shareId: text("share_id"),
    kind: genKindEnum("kind").notNull(),
    status: genStatusEnum("status").notNull().default("queued"),
    stage: text("stage"),
    modelId: text("model_id").notNull(),
    provider: text("provider").notNull(),
    providerJobId: text("provider_job_id"),
    prompt: text("prompt").notNull(),
    enhancedPrompt: text("enhanced_prompt"),
    negativePrompt: text("negative_prompt"),
    params: jsonb("params").$type<Record<string, unknown>>().notNull().default({}),
    sourceImagePath: text("source_image_path"),
    creditsQuoted: integer("credits_quoted").notNull(),
    creditsCharged: integer("credits_charged").notNull(),
    creditsRefunded: integer("credits_refunded").notNull().default(0),
    providerCostCents: integer("provider_cost_cents"),
    idempotencyKey: text("idempotency_key").notNull(),
    batchId: uuid("batch_id"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    attempt: smallint("attempt").notNull().default(0),
    queuedAt: timestamp("queued_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    visibility: visEnum("visibility").notNull().default("private"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("generations_share_id").on(t.shareId).where(sql`${t.shareId} is not null`),
    uniqueIndex("generations_workspace_idempotency").on(t.workspaceId, t.idempotencyKey),
    index("generations_workspace_created").on(t.workspaceId, t.createdAt),
    index("generations_batch_id").on(t.batchId),
    index("generations_active_status")
      .on(t.status)
      .where(sql`${t.status} not in ('ready', 'failed', 'cancelled')`),
  ],
);

export const generationAssets = pgTable("generation_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  generationId: uuid("generation_id")
    .notNull()
    .references(() => generations.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  role: assetRoleEnum("role").notNull(),
  storagePath: text("storage_path").notNull(),
  mime: text("mime").notNull(),
  bytes: bigint("bytes", { mode: "number" }).notNull(),
  width: integer("width"),
  height: integer("height"),
  durationMs: integer("duration_ms"),
  checksum: text("checksum"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shareLinks = pgTable("share_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  generationId: uuid("generation_id")
    .notNull()
    .references(() => generations.id, { onDelete: "cascade" }),
  shareId: text("share_id").notNull().unique(),
  createdBy: uuid("created_by").notNull(),
  views: integer("views").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
