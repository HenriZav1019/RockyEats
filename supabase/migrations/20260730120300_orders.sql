-- Human-readable order numbers like "A1234": a letter (A-Z) plus a 4-digit
-- zero-padded number, cycling through 26 * 10000 = 260,000 combinations before
-- repeating. Plenty of headroom for a single-city platform.
create sequence order_number_seq;

create or replace function generate_order_number()
returns text
language plpgsql
as $$
declare
  seq_val bigint;
  letter_index int;
  number_part int;
begin
  seq_val := nextval('order_number_seq') - 1;
  letter_index := (seq_val / 10000) % 26;
  number_part := seq_val % 10000;
  return chr(65 + letter_index) || lpad(number_part::text, 4, '0');
end;
$$;

create table orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id),
  order_number text not null unique default generate_order_number(),

  mode text not null check (mode in ('dine_in', 'delivery', 'pickup')),
  payment_method text not null check (payment_method in ('cash', 'transfer', 'card_terminal')),

  customer_name text not null,
  customer_phone text not null,

  total numeric(10, 2) not null check (total >= 0),
  status text not null default 'submitted'
    check (status in ('submitted', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
  payment_confirmed boolean not null default false, -- restaurant toggles manually (cash/transfer)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_restaurant_id_idx on orders (restaurant_id);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id) on delete cascade,
  menu_item_id uuid references menu_items (id) on delete set null,

  -- Snapshots so historical orders stay accurate even if the menu item's
  -- name/price changes or the item is deleted later.
  name_snapshot text not null,
  price_snapshot numeric(10, 2) not null check (price_snapshot >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(10, 2) generated always as (price_snapshot * quantity) stored
);

create index order_items_order_id_idx on order_items (order_id);

create trigger trg_orders_updated_at
  before update on orders
  for each row execute function set_updated_at();

alter table orders enable row level security;
alter table order_items enable row level security;

-- Customers have no accounts, so order creation must be open to anonymous
-- requests. Restricted to active restaurants that actually support the chosen
-- mode/payment method, so the checkout can't be tampered with client-side.
create policy "Anyone can place an order at an active restaurant that supports it"
  on orders for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from restaurants r
      where r.id = orders.restaurant_id
        and r.is_active
        and (
          (orders.mode = 'dine_in' and r.supports_dine_in)
          or (orders.mode = 'delivery' and r.supports_delivery)
          or (orders.mode = 'pickup' and r.supports_pickup)
        )
        and (
          (orders.payment_method = 'cash' and r.accepts_cash)
          or (orders.payment_method = 'transfer' and r.accepts_transfer)
          or (orders.payment_method = 'card_terminal' and r.accepts_card_terminal)
        )
    )
  );

create policy "Owners view their own restaurant's orders, admins view all"
  on orders for select
  using (restaurant_id = current_user_restaurant_id() or is_admin());

create policy "Owners and admins can update orders"
  on orders for update
  using (restaurant_id = current_user_restaurant_id() or is_admin())
  with check (restaurant_id = current_user_restaurant_id() or is_admin());

create policy "Admins can delete orders"
  on orders for delete
  using (is_admin());

create policy "Anyone can add line items to an order"
  on order_items for insert
  to anon, authenticated
  with check (exists (select 1 from orders o where o.id = order_items.order_id));

create policy "Owners view their own restaurant's order items, admins view all"
  on order_items for select
  using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and (o.restaurant_id = current_user_restaurant_id() or is_admin())
    )
  );

create policy "Admins can delete order items"
  on order_items for delete
  using (is_admin());
