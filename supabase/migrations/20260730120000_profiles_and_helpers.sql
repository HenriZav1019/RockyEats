-- Profiles link a Supabase Auth user to a platform role:
--   'admin'            -> platform-wide access (manages restaurants, users)
--   'restaurant_owner' -> scoped access to exactly one restaurant
--
-- Customers do NOT get accounts in v1 (orders are taken by name/phone, no login),
-- so this table only ever holds admin and restaurant-owner rows.

create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'restaurant_owner')),
  restaurant_id uuid, -- FK added in the restaurants migration (table doesn't exist yet)
  created_at timestamptz not null default now(),
  constraint role_restaurant_consistency check (
    (role = 'admin' and restaurant_id is null)
    or (role = 'restaurant_owner' and restaurant_id is not null)
  )
);

-- Generic "touch updated_at" trigger function, reused by later migrations.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- SECURITY DEFINER helpers so RLS policies (including on profiles itself) can check
-- the caller's role/restaurant without recursively re-triggering RLS on profiles.
create or replace function current_user_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function current_user_restaurant_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select restaurant_id from profiles where id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select
  using (id = auth.uid());

create policy "Admins can view all profiles"
  on profiles for select
  using (is_admin());

create policy "Admins can insert profiles"
  on profiles for insert
  with check (is_admin());

create policy "Admins can update profiles"
  on profiles for update
  using (is_admin())
  with check (is_admin());

create policy "Admins can delete profiles"
  on profiles for delete
  using (is_admin());

-- Bootstrap note: this policy set means the very first admin profile can't be
-- created through the app (no admin exists yet to satisfy is_admin()). Create it
-- once via the Supabase SQL editor or service_role key, e.g.:
--   insert into profiles (id, role) values ('<auth-user-uuid>', 'admin');
-- After that, admins can manage all other profiles through the app.
