-- azaisai bootstrap: schema + RLS + signup grant trigger
-- run in Supabase SQL editor if CLI login is unavailable

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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'append-only: % cannot be updated or deleted', tg_table_name;
end;
$$;

drop trigger if exists workspaces_set_updated_at on workspaces;
create trigger workspaces_set_updated_at
  before update on workspaces
  for each row execute function public.set_updated_at();

drop trigger if exists workspace_members_set_updated_at on workspace_members;
create trigger workspace_members_set_updated_at
  before update on workspace_members
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function public.set_updated_at();

drop trigger if exists credit_grants_set_updated_at on credit_grants;
create trigger credit_grants_set_updated_at
  before update on credit_grants
  for each row execute function public.set_updated_at();

drop trigger if exists generations_set_updated_at on generations;
create trigger generations_set_updated_at
  before update on generations
  for each row execute function public.set_updated_at();

drop trigger if exists credit_ledger_immutable on credit_ledger;
create trigger credit_ledger_immutable
  before update or delete on credit_ledger
  for each row execute function public.forbid_mutation();

drop trigger if exists audit_events_immutable on audit_events;
create trigger audit_events_immutable
  before update or delete on audit_events
  for each row execute function public.forbid_mutation();

create or replace function public.current_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id
  from workspace_members
  where user_id = auth.uid();
$$;

create or replace function public.current_write_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id
  from workspace_members
  where user_id = auth.uid()
    and role in ('owner', 'admin', 'member');
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid := gen_random_uuid();
  grant_row_id uuid := gen_random_uuid();
begin
  insert into workspaces (id, name, slug, plan, owner_user_id)
  values (
    ws_id,
    'Personal',
    'personal-' || replace(ws_id::text, '-', ''),
    'free',
    new.id
  );

  insert into workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner');

  insert into profiles (user_id, display_name, default_workspace_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    ws_id
  );

  insert into credit_grants (id, workspace_id, kind, amount, consumed, source_ref)
  values (grant_row_id, ws_id, 'signup', 5, 0, 'signup:' || new.id::text);

  insert into credit_ledger (
    workspace_id, amount, reason, balance_after, grant_id, idempotency_key
  )
  values (ws_id, 5, 'signup_grant', 5, grant_row_id, 'signup:' || new.id::text);

  insert into audit_events (
    workspace_id, actor_user_id, actor_type, action, subject_type, subject_id
  )
  values (ws_id, new.id, 'system', 'workspace.created', 'workspace', ws_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table profiles enable row level security;
alter table credit_grants enable row level security;
alter table credit_ledger enable row level security;
alter table generations enable row level security;
alter table generation_assets enable row level security;
alter table share_links enable row level security;
alter table subscriptions enable row level security;
alter table audit_events enable row level security;
alter table api_keys enable row level security;
alter table job_outbox enable row level security;
alter table analytics_events enable row level security;

drop policy if exists workspaces_select on workspaces;
create policy workspaces_select on workspaces
  for select using (id in (select public.current_workspace_ids()));

drop policy if exists workspaces_update on workspaces;
create policy workspaces_update on workspaces
  for update using (id in (select public.current_write_workspace_ids()));

drop policy if exists members_select on workspace_members;
create policy members_select on workspace_members
  for select using (workspace_id in (select public.current_workspace_ids()));

drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select using (user_id = auth.uid());

drop policy if exists profiles_update on profiles;
create policy profiles_update on profiles
  for update using (user_id = auth.uid());

drop policy if exists grants_select on credit_grants;
create policy grants_select on credit_grants
  for select using (workspace_id in (select public.current_workspace_ids()));

drop policy if exists ledger_select on credit_ledger;
create policy ledger_select on credit_ledger
  for select using (workspace_id in (select public.current_workspace_ids()));

drop policy if exists generations_select_member on generations;
create policy generations_select_member on generations
  for select using (workspace_id in (select public.current_workspace_ids()));

drop policy if exists generations_select_public on generations;
create policy generations_select_public on generations
  for select using (visibility = 'public' and deleted_at is null);

drop policy if exists generations_write on generations;
create policy generations_write on generations
  for insert with check (workspace_id in (select public.current_write_workspace_ids()));

drop policy if exists generations_update on generations;
create policy generations_update on generations
  for update using (workspace_id in (select public.current_write_workspace_ids()));

drop policy if exists assets_select_member on generation_assets;
create policy assets_select_member on generation_assets
  for select using (workspace_id in (select public.current_workspace_ids()));

drop policy if exists assets_select_public on generation_assets;
create policy assets_select_public on generation_assets
  for select using (
    exists (
      select 1 from generations g
      where g.id = generation_id
        and g.visibility = 'public'
        and g.deleted_at is null
    )
  );

drop policy if exists share_links_select on share_links;
create policy share_links_select on share_links
  for select using (
    workspace_id in (select public.current_workspace_ids())
    or (revoked_at is null and (expires_at is null or expires_at > now()))
  );

drop policy if exists subscriptions_select on subscriptions;
create policy subscriptions_select on subscriptions
  for select using (workspace_id in (select public.current_workspace_ids()));

drop policy if exists audit_select on audit_events;
create policy audit_select on audit_events
  for select using (workspace_id in (select public.current_workspace_ids()));

drop policy if exists api_keys_select on api_keys;
create policy api_keys_select on api_keys
  for select using (workspace_id in (select public.current_workspace_ids()));

drop policy if exists outbox_select on job_outbox;
create policy outbox_select on job_outbox
  for select using (workspace_id in (select public.current_write_workspace_ids()));

drop policy if exists analytics_insert on analytics_events;
create policy analytics_insert on analytics_events
  for insert with check (true);

drop policy if exists analytics_select on analytics_events;
create policy analytics_select on analytics_events
  for select using (
    workspace_id in (select public.current_workspace_ids())
    or user_id = auth.uid()
  );

grant select on api_keys_public to authenticated, anon;
