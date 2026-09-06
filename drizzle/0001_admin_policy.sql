do $$ begin
  create type admin_role as enum ('support', 'operator', 'superadmin');
exception when duplicate_object then null; end $$;
do $$ begin
  create type workspace_state as enum ('active', 'throttled', 'suspended', 'read_only');
exception when duplicate_object then null; end $$;

alter table workspaces add column if not exists policy_version integer not null default 0;

create table if not exists platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role admin_role not null,
  granted_by uuid,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  demo_readonly boolean not null default false
);

create table if not exists plan_policies (
  plan plan_enum primary key,
  limits jsonb not null,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists workspace_policies (
  workspace_id uuid primary key references workspaces (id) on delete cascade,
  overrides jsonb not null default '{}'::jsonb,
  state workspace_state not null default 'active',
  reason text not null,
  set_by uuid,
  set_at timestamptz not null default now(),
  expires_at timestamptz
);

create table if not exists platform_settings (
  id text primary key default 'default',
  clamps jsonb not null default '{}'::jsonb,
  provider_mode text not null default 'mock',
  daily_spend_cap_cents integer,
  signup_enabled boolean not null default true,
  maintenance_message text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_type text not null,
  action text not null,
  subject_type text,
  subject_id text,
  before jsonb,
  after jsonb,
  reason text not null,
  ip text,
  created_at timestamptz not null default now()
);

create table if not exists moderation_flags (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null,
  source text not null,
  reason text not null,
  status text not null default 'open',
  reviewed_by uuid,
  notes text,
  created_at timestamptz not null default now()
);

insert into platform_settings (id) values ('default') on conflict (id) do nothing;
