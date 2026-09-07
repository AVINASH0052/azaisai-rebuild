-- Registry so admin can see people using the service.
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

grant execute on function public.is_demo_admin() to authenticated, service_role;
grant select, insert, update on table app_users to authenticated, service_role;
