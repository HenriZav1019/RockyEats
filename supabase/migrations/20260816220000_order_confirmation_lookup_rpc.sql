-- Lets the client re-fetch a full order confirmation (order + items + restaurant)
-- by id after losing react-router's in-memory navigation state (app closed and
-- reopened, tab closed, etc). The order id is an unguessable uuid generated
-- client-side at checkout, so it acts as a de facto capability token — same
-- pattern as get_order_number / get_transfer_details.
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
      'whatsapp_enabled', r.whatsapp_enabled,
      'whatsapp_number', r.whatsapp_number
    )
  )
  from public.orders o
  join public.restaurants r on r.id = o.restaurant_id
  where o.id = p_order_id;
$function$;

grant execute on function public.get_order_confirmation(uuid) to anon, authenticated;

-- Cross-device order tracking: a customer who placed an order on a different
-- phone/browser (or cleared local storage) can look it up with the order
-- number shown at checkout plus their phone number. Requiring both fields
-- prevents anyone who only knows/guesses a phone number from pulling up a
-- stranger's name, delivery address, and order contents.
create or replace function public.lookup_order_by_number_and_phone(p_order_number text, p_phone text)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  select public.get_order_confirmation(o.id)
  from public.orders o
  where upper(o.order_number) = upper(p_order_number)
    and regexp_replace(o.customer_phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
  limit 1;
$function$;

grant execute on function public.lookup_order_by_number_and_phone(text, text) to anon, authenticated;
