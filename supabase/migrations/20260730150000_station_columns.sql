alter table menu_items add column station text not null default 'kitchen' check (station in ('kitchen', 'bar'));

alter table order_items add column station_snapshot text not null default 'kitchen' check (station_snapshot in ('kitchen', 'bar'));

alter table order_items add column item_status text not null default 'pending' check (item_status in ('pending', 'ready'));
