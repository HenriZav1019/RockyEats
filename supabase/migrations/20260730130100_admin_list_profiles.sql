-- Lets the admin panel show existing platform users with their email (which
-- lives in auth.users, not profiles) alongside their role/restaurant.
create or replace function admin_list_profiles()
returns table (
  id uuid,
  email text,
  role text,
  restaurant_id uuid,
  restaurant_name text,
  created_at timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Only admins can list profiles';
  end if;

  return query
    select p.id, u.email, p.role, p.restaurant_id, r.name, p.created_at
    from profiles p
    join auth.users u on u.id = p.id
    left join restaurants r on r.id = p.restaurant_id
    order by p.created_at desc;
end;
$$;

revoke all on function admin_list_profiles() from public;
grant execute on function admin_list_profiles() to authenticated;
