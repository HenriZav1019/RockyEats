-- =============================================================================
-- Opening hours + "pause orders" switch
--
-- restaurants.opening_hours (jsonb, nullable):
--   null                     -> no schedule set: always open (current behavior)
--   { "mon": [ {"open":"13:00","close":"16:00"}, {"open":"19:00","close":"23:00"} ],
--     "fri": [ {"open":"18:00","close":"02:00"} ],    <- close < open = past midnight
--     ... }                  -> a missing day or [] means closed that day
-- restaurants.orders_paused: owner's "we're slammed, stop taking orders" switch.
-- restaurants.timezone: IANA zone; Sonora has no DST so the default fits Peñasco.
--
-- Orders placed while closed or paused are refused with RE_RESTAURANT_CLOSED
-- (enforced by a trigger, so it covers place_order() and anything else).
--
-- Requires 20261001120000_place_order_and_lockdown.sql. Safe to run more than once.
-- =============================================================================

alter table public.restaurants add column if not exists opening_hours jsonb;
alter table public.restaurants add column if not exists orders_paused boolean not null default false;
alter table public.restaurants add column if not exists timezone text not null default 'America/Hermosillo';


-- Shape check for opening_hours ------------------------------------------------
create or replace function public.valid_opening_hours(h jsonb)
returns boolean
language sql
immutable
as $$
  select h is null or (
    jsonb_typeof(h) = 'object'
    and not exists (
      select 1
      from jsonb_each(h) as d(day, ranges)
      where d.day not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
         or jsonb_typeof(d.ranges) <> 'array'
         or case when jsonb_typeof(d.ranges) = 'array' then
              jsonb_array_length(d.ranges) > 4
              or exists (
                select 1 from jsonb_array_elements(d.ranges) r
                where jsonb_typeof(r) <> 'object'
                   or coalesce(r ->> 'open', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                   or coalesce(r ->> 'close', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                   or r ->> 'open' = r ->> 'close'
              )
            else false end
    )
  );
$$;

alter table public.restaurants drop constraint if exists restaurants_opening_hours_valid;
alter table public.restaurants add constraint restaurants_opening_hours_valid
  check (valid_opening_hours(opening_hours));


-- Is a schedule open at a given moment? ------------------------------------------
-- Times are compared as minutes since midnight to avoid any collation surprises.
create or replace function public.hhmm_to_minutes(t text)
returns int
language sql
immutable
as $$ select split_part(t, ':', 1)::int * 60 + split_part(t, ':', 2)::int $$;

create or replace function public.restaurant_is_open_at(p_hours jsonb, p_tz text, p_at timestamptz)
returns boolean
language plpgsql
stable
as $$
declare
  v_local timestamp;
  v_now int;
  v_today text;
  v_yesterday text;
begin
  if p_hours is null then
    return true;
  end if;

  v_local := p_at at time zone coalesce(p_tz, 'America/Hermosillo');
  v_now := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
  -- 'Dy' is always the English abbreviation (only 'TMDy' is localized).
  v_today := lower(to_char(v_local, 'Dy'));
  v_yesterday := lower(to_char(v_local - interval '1 day', 'Dy'));

  return exists (
    -- a range that started today
    select 1 from jsonb_array_elements(coalesce(p_hours -> v_today, '[]'::jsonb)) r
    where (hhmm_to_minutes(r ->> 'open') < hhmm_to_minutes(r ->> 'close')
           and v_now >= hhmm_to_minutes(r ->> 'open') and v_now < hhmm_to_minutes(r ->> 'close'))
       or (hhmm_to_minutes(r ->> 'close') < hhmm_to_minutes(r ->> 'open')
           and v_now >= hhmm_to_minutes(r ->> 'open'))
  ) or exists (
    -- yesterday's late-night range still running after midnight
    select 1 from jsonb_array_elements(coalesce(p_hours -> v_yesterday, '[]'::jsonb)) r
    where hhmm_to_minutes(r ->> 'close') < hhmm_to_minutes(r ->> 'open')
      and v_now < hhmm_to_minutes(r ->> 'close')
  );
end;
$$;


-- Refuse orders while closed or paused -------------------------------------------
create or replace function public.reject_order_when_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.restaurants%rowtype;
begin
  select * into r from public.restaurants where id = new.restaurant_id;
  if r.orders_paused or not restaurant_is_open_at(r.opening_hours, r.timezone, now()) then
    raise exception 'RE_RESTAURANT_CLOSED';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_reject_order_when_closed on public.orders;
create trigger trg_reject_order_when_closed
  before insert on public.orders
  for each row execute function reject_order_when_closed();


-- Owners may edit their own hours and pause switch -----------------------------------
create or replace function public.guard_restaurant_update()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or is_admin() then return new; end if;
  perform guard_columns(to_jsonb(old), to_jsonb(new), array[
    'logo_url', 'accepts_cash', 'accepts_transfer', 'accepts_card_terminal',
    'card_terminal_mexican_cards_only', 'opening_hours', 'orders_paused', 'updated_at'
  ], 'restaurant');
  return new;
end;
$$;
