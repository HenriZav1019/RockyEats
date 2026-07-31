alter table profiles drop constraint if exists profiles_role_check;

alter table profiles add constraint profiles_role_check check (role in ('admin', 'restaurant_owner', 'bar_staff', 'kitchen_staff'));

alter table profiles drop constraint if exists role_restaurant_consistency;

alter table profiles add constraint role_restaurant_consistency check ((role = 'admin' and restaurant_id is null) or (role in ('restaurant_owner', 'bar_staff', 'kitchen_staff') and restaurant_id is not null));

drop policy if exists "Owners and admins can update orders" on orders;

create policy "Owners and admins can update orders" on orders for update using ((restaurant_id = current_user_restaurant_id() and current_user_role() = 'restaurant_owner') or is_admin()) with check ((restaurant_id = current_user_restaurant_id() and current_user_role() = 'restaurant_owner') or is_admin());

create policy "Owners, admins, and station staff can update order items" on order_items for update using (exists (select 1 from orders o where o.id = order_items.order_id and (is_admin() or (o.restaurant_id = current_user_restaurant_id() and current_user_role() = 'restaurant_owner') or (o.restaurant_id = current_user_restaurant_id() and current_user_role() = 'bar_staff' and order_items.station_snapshot = 'bar') or (o.restaurant_id = current_user_restaurant_id() and current_user_role() = 'kitchen_staff' and order_items.station_snapshot = 'kitchen')))) with check (exists (select 1 from orders o where o.id = order_items.order_id and (is_admin() or (o.restaurant_id = current_user_restaurant_id() and current_user_role() = 'restaurant_owner') or (o.restaurant_id = current_user_restaurant_id() and current_user_role() = 'bar_staff' and order_items.station_snapshot = 'bar') or (o.restaurant_id = current_user_restaurant_id() and current_user_role() = 'kitchen_staff' and order_items.station_snapshot = 'kitchen'))));
