-- RUN THIS ONLY AFTER the place-order edge function is deployed and a test
-- order has gone through on the live site with Turnstile showing.
--
-- Removes the ability to call place_order() straight from the browser, so every
-- order has to pass the Turnstile check in the edge function (which calls
-- place_order() with the service role). Undo with:
--   grant execute on function public.place_order(uuid, text, text, text, text, jsonb, jsonb, numeric) to anon, authenticated;
revoke execute on function public.place_order(uuid, text, text, text, text, jsonb, jsonb, numeric) from anon, authenticated;
