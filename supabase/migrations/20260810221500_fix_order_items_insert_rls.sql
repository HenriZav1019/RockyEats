create or replace function public.order_exists(p_order_id uuid) returns boolean language sql security definer set search_path to 'public' as $$ select exists (select 1 from orders where id = p_order_id) $$;
grant execute on function public.order_exists(uuid) to anon, authenticated;
drop policy if exists "Anyone can add line items to an order" on order_items;
create policy "Anyone can add line items to an order" on order_items for insert with check (order_exists(order_items.order_id));
