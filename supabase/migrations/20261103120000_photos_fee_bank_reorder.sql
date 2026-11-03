-- =============================================================================
-- Photos, delivery fee, owner bank details, reorder support
--
--   1. "photos" storage bucket: owners upload their logo and dish photos from
--      their phone. Files live under <restaurant_id>/..., and an owner can only
--      write inside their own restaurant's folder. Anyone can view (public).
--   2. Delivery fee: restaurants.delivery_fee (null = not set, the driver tells
--      the customer; 0 = free delivery). place_order() adds it to the total for
--      delivery orders and stores it on the order.
--   3. Owners can add and edit their own bank details (CLABE) for transfers.
--   4. get_order_confirmation() also returns menu_item_id (for "Pedir de nuevo"),
--      the delivery fee and the restaurant logo.
--
-- Safe to run more than once.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Photos bucket
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 3145728, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners upload photos to their restaurant folder" on storage.objects;
drop policy if exists "Owners update photos in their restaurant folder" on storage.objects;
drop policy if exists "Owners delete photos in their restaurant folder" on storage.objects;

create policy "Owners upload photos to their restaurant folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (
      public.is_admin()
      or (
        public.current_user_role() = 'restaurant_owner'
        and (storage.foldername(name))[1] = public.current_user_restaurant_id()::text
      )
    )
  );

create policy "Owners update photos in their restaurant folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'photos'
    and (
      public.is_admin()
      or (
        public.current_user_role() = 'restaurant_owner'
        and (storage.foldername(name))[1] = public.current_user_restaurant_id()::text
      )
    )
  );

create policy "Owners delete photos in their restaurant folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'photos'
    and (
      public.is_admin()
      or (
        public.current_user_role() = 'restaurant_owner'
        and (storage.foldername(name))[1] = public.current_user_restaurant_id()::text
      )
    )
  );


-- -----------------------------------------------------------------------------
-- 2. Delivery fee
-- -----------------------------------------------------------------------------
alter table public.restaurants add column if not exists delivery_fee numeric(10, 2);
alter table public.restaurants drop constraint if exists restaurants_delivery_fee_range;
alter table public.restaurants add constraint restaurants_delivery_fee_range
  check (delivery_fee is null or (delivery_fee >= 0 and delivery_fee <= 1000));

-- On the order: the fee charged, or null when the driver collects it (also
-- null on orders placed before this migration).
alter table public.orders add column if not exists delivery_fee numeric(10, 2) check (delivery_fee >= 0);

-- Owners may now also change delivery_fee from Ajustes.
create or replace function public.guard_restaurant_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or is_admin() then return new; end if;
  perform guard_columns(to_jsonb(old), to_jsonb(new), array[
    'logo_url', 'accepts_cash', 'accepts_transfer', 'accepts_card_terminal',
    'card_terminal_mexican_cards_only', 'opening_hours', 'orders_paused',
    'delivery_fee', 'updated_at'
  ], 'restaurant');
  return new;
end;
$$;

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
  v_fee numeric(10, 2) := 0;
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

  -- Delivery fee set by the restaurant (null = not set, driver tells the customer).
  if p_mode = 'delivery' then
    v_fee := r.delivery_fee;  -- may be null: collected by the driver
  end if;
  v_total := v_total + coalesce(v_fee, 0);

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
    id, restaurant_id, mode, payment_method, customer_name, customer_phone, total, delivery_fee,
    status, payment_confirmed,
    delivery_street, delivery_number, delivery_between_streets, delivery_reference,
    delivery_is_hotel_or_condo, delivery_unit_number
  ) values (
    v_order_id, r.id, p_mode, p_payment_method, v_name, v_phone, v_total, v_fee,
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

-- (create or replace keeps the existing execute grants, so this does not undo
-- supabase/pending/require_turnstile.sql if it has already been run.)


-- -----------------------------------------------------------------------------
-- 3. Owners manage their own bank details
-- -----------------------------------------------------------------------------
drop policy if exists "Owners add their own payment details" on public.restaurant_payment_details;
drop policy if exists "Owners update their own payment details" on public.restaurant_payment_details;

create policy "Owners add their own payment details"
  on public.restaurant_payment_details for insert to authenticated
  with check (restaurant_id = current_user_restaurant_id() and current_user_role() = 'restaurant_owner');

create policy "Owners update their own payment details"
  on public.restaurant_payment_details for update to authenticated
  using (restaurant_id = current_user_restaurant_id() and current_user_role() = 'restaurant_owner')
  with check (restaurant_id = current_user_restaurant_id() and current_user_role() = 'restaurant_owner');

grant select, insert, update on public.restaurant_payment_details to authenticated;


-- -----------------------------------------------------------------------------
-- 4. Order confirmation: + menu_item_id, delivery_fee, restaurant logo
-- -----------------------------------------------------------------------------
create or replace function public.get_order_confirmation(p_order_id uuid)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'order', jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'restaurant_id', o.restaurant_id,
      'mode', o.mode,
      'payment_method', o.payment_method,
      'customer_name', o.customer_name,
      'customer_phone', o.customer_phone,
      'total', o.total,
      'delivery_fee', o.delivery_fee,
      'status', o.status,
      'payment_confirmed', o.payment_confirmed,
      'created_at', o.created_at,
      'delivery_street', o.delivery_street,
      'delivery_number', o.delivery_number,
      'delivery_between_streets', o.delivery_between_streets,
      'delivery_reference', o.delivery_reference,
      'delivery_is_hotel_or_condo', o.delivery_is_hotel_or_condo,
      'delivery_unit_number', o.delivery_unit_number
    ),
    'order_items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'menu_item_id', oi.menu_item_id,
        'name', oi.name_snapshot,
        'price', oi.price_snapshot,
        'quantity', oi.quantity,
        'notes', oi.notes
      )), '[]'::jsonb)
      from public.order_items oi
      where oi.order_id = o.id
    ),
    'restaurant', jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'logo_url', r.logo_url,
      'whatsapp_enabled', r.whatsapp_enabled,
      'whatsapp_number', r.whatsapp_number
    )
  )
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  where o.id = p_order_id;
$function$;

grant execute on function public.get_order_confirmation(uuid) to anon, authenticated;
