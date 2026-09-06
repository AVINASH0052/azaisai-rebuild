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

alter table platform_admins enable row level security;
alter table plan_policies enable row level security;
alter table workspace_policies enable row level security;
alter table platform_settings enable row level security;
alter table admin_actions enable row level security;
alter table moderation_flags enable row level security;

drop policy if exists platform_admins_self on platform_admins;
create policy platform_admins_self on platform_admins
  for select using (user_id = auth.uid() and revoked_at is null);

drop trigger if exists admin_actions_immutable on admin_actions;
create trigger admin_actions_immutable
  before update or delete on admin_actions
  for each row execute function public.forbid_mutation();

alter table generation_segments enable row level security;
drop policy if exists generation_segments_select on generation_segments;
create policy generation_segments_select on generation_segments
  for select using (
    exists (
      select 1 from generations g
      where g.id = generation_id
        and g.workspace_id in (select public.current_workspace_ids())
    )
  );

