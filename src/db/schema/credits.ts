import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { grantKindEnum, ledgerReasonEnum } from "./enums";
import { workspaces } from "./workspaces";

export const creditGrants = pgTable("credit_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  kind: grantKindEnum("kind").notNull(),
  amount: integer("amount").notNull(),
  consumed: integer("consumed").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  sourceRef: text("source_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    reason: ledgerReasonEnum("reason").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    generationId: uuid("generation_id"),
    grantId: uuid("grant_id").references(() => creditGrants.id),
    stripeEventId: text("stripe_event_id"),
    idempotencyKey: text("idempotency_key"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("credit_ledger_idempotency_key")
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    uniqueIndex("credit_ledger_stripe_event_id")
      .on(t.stripeEventId)
      .where(sql`${t.stripeEventId} is not null`),
    check("credit_ledger_amount_nonzero", sql`${t.amount} <> 0`),
    check("credit_ledger_balance_after_nonneg", sql`${t.balanceAfter} >= 0`),
  ],
);
