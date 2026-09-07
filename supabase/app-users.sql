-- Hearth user registry: usage, credits, ban. Run in the AZAISAI SQL editor.
create or replace function public.is_demo_admin()
returns boolean
language sql
stable
security definer
set search_path = auth
as $$
  select exists (
    select 1 from auth.users
    where id = auth.uid()
      and lower(email) = 'admin@azaisai.test'
  );
$$;

create table if not exists app_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  credits integer not null default 80,
  banned boolean not null default false,
  generations integer not null default 0,
  credits_spent integer not null default 0,
  last_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table app_users add column if not exists banned boolean not null default false;
alter table app_users add column if not exists generations integer not null default 0;
alter table app_users add column if not exists credits_spent integer not null default 0;
alter table app_users add column if not exists last_generated_at timestamptz;

alter table app_users enable row level security;

drop policy if exists app_users_insert on app_users;
create policy app_users_insert on app_users
  for insert with check (user_id = auth.uid() or public.is_demo_admin());

drop policy if exists app_users_select on app_users;
create policy app_users_select on app_users
  for select using (user_id = auth.uid() or public.is_demo_admin());

drop policy if exists app_users_update on app_users;
create policy app_users_update on app_users
  for update using (user_id = auth.uid() or public.is_demo_admin());

create or replace function public.list_hearth_users()
returns table (
  user_id uuid,
  email text,
  credits integer,
  banned boolean,
  generations integer,
  credits_spent integer,
  created_at timestamptz,
  last_generated_at timestamptz
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    u.id,
    u.email,
    coalesce(a.credits, coalesce((u.raw_user_meta_data->>'credits')::int, 80)),
    coalesce(a.banned, coalesce((u.raw_user_meta_data->>'banned')::boolean, false)),
    coalesce(a.generations, coalesce((u.raw_user_meta_data->>'generations')::int, 0)),
    coalesce(a.credits_spent, coalesce((u.raw_user_meta_data->>'credits_spent')::int, 0)),
    u.created_at,
    a.last_generated_at
  from auth.users u
  left join public.app_users a on a.user_id = u.id
  where public.is_demo_admin();
$$;

grant execute on function public.is_demo_admin() to authenticated, service_role;
grant execute on function public.list_hearth_users() to authenticated, service_role;
grant select, insert, update on table app_users to authenticated, service_role;
