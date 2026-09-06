create extension if not exists citext;

do $$ begin
  create type plan_enum as enum ('free', 'starter', 'pro', 'business');
exception when duplicate_object then null; end $$;
do $$ begin
  create type role_enum as enum ('owner', 'admin', 'member', 'viewer');
exception when duplicate_object then null; end $$;
do $$ begin
  create type ledger_reason as enum (
    'signup_grant', 'referral_grant', 'promo_grant', 'subscription_grant',
    'topup_purchase', 'generation_debit', 'generation_refund', 'expiry',
    'admin_adjustment', 'chargeback'
  );
exception when duplicate_object then null; end $$;
do $$ begin
  create type grant_kind as enum ('signup', 'subscription', 'topup', 'promo', 'referral');
exception when duplicate_object then null; end $$;
do $$ begin
  create type gen_kind as enum ('video', 'image');
exception when duplicate_object then null; end $$;
do $$ begin
  create type gen_status as enum (
    'queued', 'submitted', 'processing', 'downloading', 'ready', 'failed', 'cancelled'
  );
exception when duplicate_object then null; end $$;
do $$ begin
  create type vis_enum as enum ('private', 'unlisted', 'public');
exception when duplicate_object then null; end $$;
do $$ begin
  create type asset_role as enum ('output', 'thumbnail', 'preview', 'source', 'watermarked');
exception when duplicate_object then null; end $$;
do $$ begin
  create type sub_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete');
exception when duplicate_object then null; end $$;
do $$ begin
  create type actor_type as enum ('user', 'system', 'admin', 'api_key');
exception when duplicate_object then null; end $$;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Personal',
  slug citext not null unique,
  plan plan_enum not null default 'free',
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role role_enum not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  default_workspace_id uuid references workspaces (id),
  referred_by uuid,
  marketing_opt_in boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists credit_grants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  kind grant_kind not null,
  amount integer not null check (amount > 0),
  consumed integer not null default 0 check (consumed >= 0),
  expires_at timestamptz,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists credit_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  amount integer not null check (amount <> 0),
  reason ledger_reason not null,
  balance_after integer not null check (balance_after >= 0),
  generation_id uuid,
  grant_id uuid references credit_grants (id),
  stripe_event_id text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists credit_ledger_idempotency_key
  on credit_ledger (idempotency_key) where idempotency_key is not null;
create unique index if not exists credit_ledger_stripe_event_id
  on credit_ledger (stripe_event_id) where stripe_event_id is not null;
create index if not exists credit_ledger_workspace_created
  on credit_ledger (workspace_id, created_at desc);

create table if not exists generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  created_by_user_id uuid not null references auth.users (id),
  share_id text,
  kind gen_kind not null,
  status gen_status not null default 'queued',
  stage text,
  model_id text not null,
  provider text not null,
  provider_job_id text,
  prompt text not null,
  enhanced_prompt text,
  negative_prompt text,
  params jsonb not null default '{}'::jsonb,
  source_image_path text,
  credits_quoted integer not null,
  credits_charged integer not null,
  credits_refunded integer not null default 0,
  provider_cost_cents integer,
  idempotency_key text not null,
  batch_id uuid,
  error_code text,
  error_message text,
  attempt smallint not null default 0,
  queued_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  visibility vis_enum not null default 'private',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists generations_share_id
  on generations (share_id) where share_id is not null;
create unique index if not exists generations_workspace_idempotency
  on generations (workspace_id, idempotency_key);
create index if not exists generations_workspace_created
  on generations (workspace_id, created_at desc);
create index if not exists generations_batch_id on generations (batch_id);
create index if not exists generations_active_status
  on generations (status) where status not in ('ready', 'failed', 'cancelled');

do $$ begin
  alter table credit_ledger
    add constraint credit_ledger_generation_id_fkey
    foreign key (generation_id) references generations (id) on delete set null;
exception when duplicate_object then null;
end $$;

create table if not exists generation_assets (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references generations (id) on delete cascade,
  workspace_id uuid not null references workspaces (id) on delete cascade,
  role asset_role not null,
  storage_path text not null,
  mime text not null,
  bytes bigint not null,
  width integer,
  height integer,
  duration_ms integer,
  checksum text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  generation_id uuid not null references generations (id) on delete cascade,
  share_id text not null unique,
  created_by uuid not null references auth.users (id),
  views integer not null default 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references workspaces (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan plan_enum not null default 'free',
  status sub_status not null default 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  price_in_cents integer,
  currency char(3) not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces (id) on delete cascade,
  actor_user_id uuid,
  actor_type actor_type not null,
  action text not null,
  subject_type text,
  subject_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_workspace_created
  on audit_events (workspace_id, created_at desc);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists job_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  generation_id uuid not null unique references generations (id) on delete cascade,
  run_after timestamptz not null default now(),
  attempts smallint not null default 0,
  locked_until timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_outbox_claim on job_outbox (run_after, locked_until);

create table if not exists analytics_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces (id) on delete set null,
  user_id uuid,
  anonymous_id text,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  session_id text,
  created_at timestamptz not null default now()
);

create or replace view api_keys_public as
  select id, workspace_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at
  from api_keys;
