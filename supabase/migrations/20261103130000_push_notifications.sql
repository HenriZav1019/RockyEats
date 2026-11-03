-- =============================================================================
-- Phone alerts (web push) for new orders, even with the dashboard closed
--
--   * push_subscriptions: one row per phone/browser that turned alerts on.
--   * When an order arrives, the owner's phones get "Nuevo pedido".
--     When an order reaches the kitchen/bar (paid, or card terminal), the
--     kitchen and bar phones get it, only if the order has items for them.
--   * A trigger asks the notify-order edge function to send the alerts
--     (through pg_net, after the order is saved, so it can never block or
--     slow down placing an order).
--
-- The edge function and the trigger share a random secret that this migration
-- creates in private.app_settings, so there is nothing to copy by hand.
-- Safe to run more than once.
-- =============================================================================

create extension if not exists pg_net with schema extensions;

-- -----------------------------------------------------------------------------
-- Private settings (not reachable through the API)
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_settings (
  key text primary key,
  value text not null
);

insert into private.app_settings (key, value) values
  ('notify_order_url', 'https://fvkzmfbopvhhvzgwnenx.supabase.co/functions/v1/notify-order'),
  ('notify_order_secret', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;

-- The edge function (service role) reads the secret through this function.
create or replace function public.get_notify_order_secret()
returns text
language sql
security definer
set search_path = ''
as $$
  select value from private.app_settings where key = 'notify_order_secret';
$$;
revoke all on function public.get_notify_order_secret() from public, anon, authenticated;
grant execute on function public.get_notify_order_secret() to service_role;


-- -----------------------------------------------------------------------------
-- Subscriptions
-- -----------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_restaurant_idx on public.push_subscriptions (restaurant_id, role);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users see their own push subscriptions" on public.push_subscriptions;
create policy "Users see their own push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

revoke all on public.push_subscriptions from anon;
revoke insert, update, delete on public.push_subscriptions from authenticated;
grant select on public.push_subscriptions to authenticated;

-- Saves this phone for the signed-in staff member. If the phone was used by
-- someone else before (shared tablet), it moves to the current person.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := current_user_role();
  v_restaurant uuid := current_user_restaurant_id();
begin
  if auth.uid() is null or v_restaurant is null
     or v_role not in ('restaurant_owner', 'kitchen_staff', 'bar_staff') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' or length(p_endpoint) > 1000
     or length(coalesce(p_p256dh, '')) not between 20 and 200
     or length(coalesce(p_auth, '')) not between 8 and 100 then
    raise exception 'Invalid subscription' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (endpoint, p256dh, auth, user_id, restaurant_id, role)
  values (p_endpoint, p_p256dh, p_auth, auth.uid(), v_restaurant, v_role)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_id = excluded.user_id,
        restaurant_id = excluded.restaurant_id,
        role = excluded.role,
        created_at = now();
end;
$$;

create or replace function public.remove_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke all on function public.save_push_subscription(text, text, text) from public, anon;
revoke all on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;


-- -----------------------------------------------------------------------------
-- Trigger: ask the edge function to send alerts
-- -----------------------------------------------------------------------------
create or replace function public.notify_order_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_events text[] := '{}';
  v_url text;
  v_secret text;
begin
  if tg_op = 'INSERT' then
    v_events := array['new'];
    -- Card-terminal orders go straight to the kitchen/bar.
    if new.payment_method = 'card_terminal' then
      v_events := array_append(v_events, 'stations');
    end if;
  elsif tg_op = 'UPDATE'
        and new.payment_confirmed and not old.payment_confirmed
        and new.payment_method <> 'card_terminal'
        and new.status in ('submitted', 'confirmed', 'preparing') then
    v_events := array['stations'];
  end if;

  if cardinality(v_events) = 0 then
    return null;
  end if;

  begin
    select value into v_url from private.app_settings where key = 'notify_order_url';
    select value into v_secret from private.app_settings where key = 'notify_order_secret';
    if v_url is null or v_secret is null then
      return null;
    end if;
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object('order_id', new.id, 'events', to_jsonb(v_events)),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-secret', v_secret),
      timeout_milliseconds := 8000
    );
  exception when others then
    -- Alerts are a nice-to-have: never let them break an order.
    raise warning 'notify_order_push failed: %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists trg_notify_order_push on public.orders;
create trigger trg_notify_order_push
  after insert or update of payment_confirmed on public.orders
  for each row execute function public.notify_order_push();
