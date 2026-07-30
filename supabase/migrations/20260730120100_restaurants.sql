create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  phone text,
  whatsapp_number text, -- E.164 format, e.g. +526381234567
  whatsapp_enabled boolean not null default true,

  supports_dine_in boolean not null default true,
  supports_delivery boolean not null default false,
  supports_pickup boolean not null default true,
  own_transport boolean not null default false,

  accepts_cash boolean not null default true,
  accepts_transfer boolean not null default false,
  accepts_card_terminal boolean not null default false,
  bank_account_details jsonb not null default '{}'::jsonb,
  -- Shape: { "bank_name": "...", "account_holder": "...", "clabe": "...", "notes": "..." }
  -- Shown to customers on the transfer-payment screen; only relevant restaurants
  -- accepting transfer need to fill it in.

  is_active boolean not null default true, -- admin can hide a restaurant without deleting it
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles
  add constraint profiles_restaurant_id_fkey
  foreign key (restaurant_id) references restaurants (id) on delete restrict;

create trigger trg_restaurants_updated_at
  before update on restaurants
  for each row execute function set_updated_at();

alter table restaurants enable row level security;

create policy "Public can view active restaurants"
  on restaurants for select
  using (is_active or is_admin());

create policy "Admins can insert restaurants"
  on restaurants for insert
  with check (is_admin());

create policy "Admins can update restaurants"
  on restaurants for update
  using (is_admin())
  with check (is_admin());

create policy "Admins can delete restaurants"
  on restaurants for delete
  using (is_admin());
