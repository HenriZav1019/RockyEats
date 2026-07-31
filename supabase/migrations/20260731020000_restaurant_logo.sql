alter table restaurants add column logo_url text;
create policy "Owners can update their own restaurant's logo" on restaurants for update using (id = current_user_restaurant_id() and current_user_role() = 'restaurant_owner') with check (id = current_user_restaurant_id() and current_user_role() = 'restaurant_owner');
grant update (logo_url) on restaurants to authenticated;
