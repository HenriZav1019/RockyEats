create or replace function public.get_transfer_details(p_order_id uuid) returns table(bank_name text, account_holder text, clabe text, notes text) language sql security definer set search_path to 'public' as $function$ select pd.bank_name, pd.account_holder, pd.clabe, pd.notes from public.orders o join public.restaurant_payment_details pd on pd.restaurant_id = o.restaurant_id where o.id = p_order_id and o.payment_method = 'transfer'; $function$;
grant execute on function public.get_transfer_details(uuid) to anon, authenticated;
create or replace function public.get_order_number(p_order_id uuid) returns text language sql security definer set search_path to 'public' as $function$ select order_number from public.orders where id = p_order_id; $function$;
grant execute on function public.get_order_number(uuid) to anon, authenticated;
drop function if exists public.whoami();
drop function if exists public.check_order_insert(uuid, text, text);
