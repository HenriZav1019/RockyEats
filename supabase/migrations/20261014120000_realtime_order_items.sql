-- Kitchen/bar screens and the owner's Orders page listen for item changes
-- ("Coctel listo") so every device updates at once. Until now only `orders`
-- was published, so marking an item ready on one tablet didn't show on others.
-- Realtime still applies the existing RLS select policy on order_items, so a
-- device only receives items from its own restaurant.
-- Safe to run more than once.
do $$
begin
  alter publication supabase_realtime add table public.order_items;
exception when duplicate_object then null;
end $$;
