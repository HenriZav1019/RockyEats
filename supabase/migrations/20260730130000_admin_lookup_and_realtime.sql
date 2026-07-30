-- Lets an admin assign restaurant ownership by typing an email instead of a raw
-- UUID. Restricted to admins (checked inside, since it needs to read auth.users
-- which normal roles can't query directly).
create or replace function admin_lookup_user_id_by_email(lookup_email text)
returns uuid
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result uuid;
begin
  if not is_admin() then
    raise exception 'Only admins can look up users by email';
  end if;

  select id into result from auth.users where email = lookup_email;
  return result;
end;
$$;

revoke all on function admin_lookup_user_id_by_email(text) from public;
grant execute on function admin_lookup_user_id_by_email(text) to authenticated;

-- Lets the restaurant dashboard subscribe to live order inserts/updates instead
-- of polling. Realtime still enforces the existing RLS select policy on orders,
-- so an owner only ever receives events for their own restaurant.
alter publication supabase_realtime add table orders;
