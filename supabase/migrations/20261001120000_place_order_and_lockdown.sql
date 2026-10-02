-- =============================================================================
-- Server-side order placement + permission lockdown
--
-- Before this migration the browser inserted rows into orders/order_items
-- directly, choosing its own prices, total, status and payment_confirmed.
-- After it:
--   * place_order() is the ONLY way to create an order. It looks up real prices
--     from menu_items, checks availability/mode/payment, forces status to
--     'submitted' and payment_confirmed to false, and writes the order and its
--     items in a single transaction (so the dashboard never sees an empty order).
--   * Direct inserts into orders/order_items are blocked for API roles.
--   * Owners/staff can only change the specific columns their screens edit.
--   * restaurant_payment_details (created by hand in the dashboard) is now
--     codified here with explicit policies, and the old, publicly readable
--     restaurants.bank_account_details column is migrated and dropped.
--
-- Safe to run more than once.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Bank details: codify the table, lock it down, retire the old column
-- -----------------------------------------------------------------------------
create table if not exists public.restaurant_payment_details (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  bank_name text,
  account_holder text,
  clabe text,
  notes text
);

alter table public.restaurant_payment_details enable row level security;

-- Replace whatever policies were created by hand with a known set.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'restaurant_payment_details'
  loop
    execute format('drop policy %I on public.restaurant_payment_details', p.policyname);
  end loop;
end $$;

create policy "Admins manage payment details"
  on public.restaurant_payment_details for all
  using (is_admin()) with check (is_admin());

create policy "Owners view their own payment details"
  on public.restaurant_payment_details for select
  using (restaurant_id = current_user_restaurant_id() and current_user_role() = 'restaurant_owner');

-- Customers get transfer details only through get_transfer_details(order_id).
revoke all on public.restaurant_payment_details from anon;

-- restaurants.bank_account_details was readable by anyone (the public menu page
-- selects * from restaurants). Copy anything still in it, then drop it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'restaurants' and column_name = 'bank_account_details'
  ) then
    insert into public.restaurant_payment_details (restaurant_id, bank_name, account_holder, clabe, notes)
    select id,
           nullif(bank_account_details ->> 'bank_name', ''),
           nullif(bank_account_details ->> 'account_holder', ''),
           nullif(bank_account_details ->> 'clabe', ''),
           nullif(bank_account_details ->> 'notes', '')
    from public.restaurants
    where bank_account_details is not null and bank_account_details <> '{}'::jsonb
    on conflict (restaurant_id) do nothing;

    alter table public.restaurants drop column bank_account_details;
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 2. Column guards: non-admins may only change what their screens edit
--    (Postgres column GRANTs can't do this here: admins and owners share the
--    same 'authenticated' database role, so the check has to look at who the
--    user is.) Requests with no user (SQL editor, service role) pass through.
-- -----------------------------------------------------------------------------
create or replace function public.guard_columns(p_old jsonb, p_new jsonb, p_allowed text[], p_what text)
returns void
language plpgsql
as $$
begin
  if (p_new - p_allowed) is distinct from (p_old - p_allowed) then
    raise exception 'Not allowed to change % fields other than: %', p_what, array_to_string(p_allowed, ', ')
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.guard_restaurant_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or is_admin() then return new; end if;
  perform guard_columns(to_jsonb(old), to_jsonb(new), array[
    'logo_url', 'accepts_cash', 'accepts_transfer', 'accepts_card_terminal',
    'card_terminal_mexican_cards_only', 'updated_at'
  ], 'restaurant');
  return new;
end;
$$;

drop trigger if exists trg_guard_restaurant_update on public.restaurants;
create trigger trg_guard_restaurant_update
  before update on public.restaurants
  for each row execute function guard_restaurant_update();

create or replace function public.guard_order_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or is_admin() then return new; end if;
  perform guard_columns(to_jsonb(old), to_jsonb(new),
    array['status', 'payment_confirmed', 'updated_at'], 'order');
  return new;
end;
$$;

drop trigger if exists trg_guard_order_update on public.orders;
create trigger trg_guard_order_update
  before update on public.orders
  for each row execute function guard_order_update();

create or replace function public.guard_order_item_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or is_admin() then return new; end if;
  -- line_total is a generated column: NULL in NEW until after BEFORE triggers run.
  perform guard_columns(to_jsonb(old) - 'line_total', to_jsonb(new) - 'line_total', array['item_status'], 'order item');
  return new;
end;
$$;

drop trigger if exists trg_guard_order_item_update on public.order_items;
create trigger trg_guard_order_item_update
  before update on public.order_items
  for each row execute function guard_order_item_update();


-- -----------------------------------------------------------------------------
-- 3. Block direct inserts into orders / order_items
-- -----------------------------------------------------------------------------
drop policy if exists "Anyone can place an order at an active restaurant that supports it" on public.orders;
drop policy if exists "Anyone can add line items to an order" on public.order_items;
revoke insert on public.orders, public.order_items from anon, authenticated;
drop function if exists public.order_exists(uuid);


-- -----------------------------------------------------------------------------
-- 4. place_order(): the only way in
--
-- p_items:    [{ "menu_item_id": uuid, "quantity": 1-99, "notes": text? }, ...]
-- p_delivery: { "street", "number", "between_streets", "reference",
--               "is_hotel_or_condo", "unit_number" }  (delivery mode only)
-- p_expected_total: the total the customer saw. If prices changed since they
--               loaded the menu, the order is refused with RE_PRICE_CHANGED so
--               they can review it instead of being charged a surprise amount.
--
-- Errors are raised with stable codes (RE_*) that the frontend translates.
-- Returns the same JSON shape as get_order_confirmation().
-- -----------------------------------------------------------------------------
create or replace function public.place_order(
  p_restaurant_id uuid,
  p_mode text,
  p_payment_method text,
  p_customer_name text,
  p_customer_phone text,
  p_items jsonb,
  p_delivery jsonb default null,
  p_expected_total numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurants%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_phone text := btrim(coalesce(p_customer_phone, ''));
  v_phone_digits text := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  v_phone_key text;  -- last 10 digits, so "+52 638..." and "638..." count as the same phone
  v_requested int;
  v_matched int;
  v_unavailable text;
  v_total numeric(10, 2);
  v_recent int;
  v_street text;
  v_number text;
  v_is_hotel boolean;
  v_unit text;
begin
  -- Customer details ---------------------------------------------------------
  if length(v_name) < 1 or length(v_name) > 80 then
    raise exception 'RE_INVALID_NAME';
  end if;
  if length(v_phone_digits) < 10 or length(v_phone_digits) > 15 or length(v_phone) > 25 then
    raise exception 'RE_INVALID_PHONE';
  end if;

  v_phone_key := right(v_phone_digits, 10);

  -- Restaurant, mode, payment ---------------------------------------------------
  select * into r from public.restaurants where id = p_restaurant_id and is_active;
  if not found then
    raise exception 'RE_RESTAURANT_UNAVAILABLE';
  end if;

  if not coalesce(case p_mode
      when 'dine_in' then r.supports_dine_in
      when 'delivery' then r.supports_delivery
      when 'pickup' then r.supports_pickup
    end, false) then
    raise exception 'RE_MODE_UNAVAILABLE';
  end if;

  if not coalesce(case p_payment_method
      when 'cash' then r.accepts_cash
      when 'transfer' then r.accepts_transfer
      when 'card_terminal' then r.accepts_card_terminal
    end, false) then
    raise exception 'RE_PAYMENT_UNAVAILABLE';
  end if;

  -- Delivery address ----------------------------------------------------------
  if p_mode = 'delivery' then
    v_street := btrim(coalesce(p_delivery ->> 'street', ''));
    v_number := btrim(coalesce(p_delivery ->> 'number', ''));
    v_is_hotel := coalesce(p_delivery ->> 'is_hotel_or_condo', '') = 'true';
    v_unit := nullif(btrim(coalesce(p_delivery ->> 'unit_number', '')), '');
    if v_street = '' or v_number = '' or length(v_street) > 200 or length(v_number) > 30
       or length(coalesce(p_delivery ->> 'between_streets', '')) > 200
       or length(coalesce(p_delivery ->> 'reference', '')) > 500
       or (v_is_hotel and (v_unit is null or length(v_unit) > 30)) then
      raise exception 'RE_INVALID_ADDRESS';
    end if;
  end if;

  -- Items: shape -------------------------------------------------------------------
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'RE_INVALID_ITEMS';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where jsonb_typeof(e) <> 'object'
       or coalesce(e ->> 'menu_item_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(e ->> 'quantity', '') !~ '^[0-9]{1,2}$'
       or case when coalesce(e ->> 'quantity', '') ~ '^[0-9]{1,2}$'
               then (e ->> 'quantity')::int < 1 else true end
       or length(coalesce(e ->> 'notes', '')) > 300
  ) then
    raise exception 'RE_INVALID_ITEMS';
  end if;

  -- Items: every one must be a real, available item from THIS restaurant -----------
  select count(*), count(m.id),
         string_agg(case when m.id is null then (e ->> 'menu_item_id') end, ',')
    into v_requested, v_matched, v_unavailable
  from jsonb_array_elements(p_items) e
  left join public.menu_items m
    on m.id = (e ->> 'menu_item_id')::uuid
   and m.restaurant_id = r.id
   and m.available;

  if v_matched < v_requested then
    raise exception 'RE_ITEM_UNAVAILABLE' using detail = v_unavailable;
  end if;

  select sum(m.price * (e ->> 'quantity')::int)
    into v_total
  from jsonb_array_elements(p_items) e
  join public.menu_items m on m.id = (e ->> 'menu_item_id')::uuid;

  if p_expected_total is not null and abs(p_expected_total - v_total) >= 0.01 then
    raise exception 'RE_PRICE_CHANGED' using detail = v_total::text;
  end if;

  -- Rate limits (Turnstile is the main spam defense; this is the backstop) ---------
  select count(*) into v_recent
  from public.orders
  where right(regexp_replace(customer_phone, '\D', '', 'g'), 10) = v_phone_key
    and created_at > now() - interval '10 minutes';
  if v_recent >= 3 then
    raise exception 'RE_RATE_LIMITED';
  end if;

  select count(*) into v_recent
  from public.orders
  where restaurant_id = r.id and created_at > now() - interval '1 minute';
  if v_recent >= 20 then
    raise exception 'RE_RATE_LIMITED';
  end if;

  -- Write the order and its items together --------------------------------------
  insert into public.orders (
    id, restaurant_id, mode, payment_method, customer_name, customer_phone, total,
    status, payment_confirmed,
    delivery_street, delivery_number, delivery_between_streets, delivery_reference,
    delivery_is_hotel_or_condo, delivery_unit_number
  ) values (
    v_order_id, r.id, p_mode, p_payment_method, v_name, v_phone, v_total,
    'submitted', false,
    case when p_mode = 'delivery' then v_street end,
    case when p_mode = 'delivery' then v_number end,
    case when p_mode = 'delivery' then nullif(btrim(coalesce(p_delivery ->> 'between_streets', '')), '') end,
    case when p_mode = 'delivery' then nullif(btrim(coalesce(p_delivery ->> 'reference', '')), '') end,
    p_mode = 'delivery' and coalesce(v_is_hotel, false),
    case when p_mode = 'delivery' and v_is_hotel then v_unit end
  );

  insert into public.order_items (
    order_id, menu_item_id, name_snapshot, price_snapshot, station_snapshot, quantity, notes
  )
  select v_order_id, m.id, m.name, m.price, m.station, (e ->> 'quantity')::int,
         nullif(btrim(coalesce(e ->> 'notes', '')), '')
  from jsonb_array_elements(p_items) with ordinality as t(e, ord)
  join public.menu_items m on m.id = (e ->> 'menu_item_id')::uuid
  order by ord;

  return public.get_order_confirmation(v_order_id);
end;
$$;

revoke all on function public.place_order(uuid, text, text, text, text, jsonb, jsonb, numeric) from public;
-- anon/authenticated can call it directly until Turnstile is live; then run
-- supabase/pending/require_turnstile.sql to make the edge function the only way in.
grant execute on function public.place_order(uuid, text, text, text, text, jsonb, jsonb, numeric)
  to anon, authenticated, service_role;
