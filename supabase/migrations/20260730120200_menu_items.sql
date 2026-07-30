create table menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  category text,
  photo_url text,
  available boolean not null default true, -- restaurants toggle this off when sold out
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_items_restaurant_id_idx on menu_items (restaurant_id);

create trigger trg_menu_items_updated_at
  before update on menu_items
  for each row execute function set_updated_at();

alter table menu_items enable row level security;

-- Customers see the full menu (including sold-out items, marked unavailable in the
-- UI) for any active restaurant. Owners/admins can also see their own items even if
-- the restaurant is temporarily deactivated.
create policy "Menu items are viewable by customers, owners, and admins"
  on menu_items for select
  using (
    is_admin()
    or restaurant_id = current_user_restaurant_id()
    or exists (
      select 1 from restaurants r
      where r.id = menu_items.restaurant_id and r.is_active
    )
  );

create policy "Owners and admins can insert menu items"
  on menu_items for insert
  with check (restaurant_id = current_user_restaurant_id() or is_admin());

create policy "Owners and admins can update menu items"
  on menu_items for update
  using (restaurant_id = current_user_restaurant_id() or is_admin())
  with check (restaurant_id = current_user_restaurant_id() or is_admin());

create policy "Owners and admins can delete menu items"
  on menu_items for delete
  using (restaurant_id = current_user_restaurant_id() or is_admin());
