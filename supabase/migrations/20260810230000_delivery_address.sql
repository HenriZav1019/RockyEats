alter table orders add column delivery_street text;
alter table orders add column delivery_number text;
alter table orders add column delivery_between_streets text;
alter table orders add column delivery_reference text;
alter table orders add column delivery_is_hotel_or_condo boolean not null default false;
alter table orders add column delivery_unit_number text;
