# RockyEats — Session Log

Running log of what's been built, kept in the repo so it's readable from any device/account that pulls this project. Newest entries at the top. Updated by Claude Code as work happens — not a design doc, just a changelog with enough context to pick the conversation back up.

---

## 2026-07-30 — Branding pass (PAUSED mid-work — pick up here)

User provided 3 reference marketing images (a square badge logo, a wordmark-on-glow render, and a wide banner) and asked for the real RockyEats brand (navy / orange / teal, script "Rocky" + bold "EATS" wordmark, rock-arch/lighthouse sunset badge, Puerto Peñasco boardwalk photography) to actually appear on the site — mobile home screen styled like the badge image, desktop hero styled like the wide banner.

**Done so far:**
- Processed the 3 source PNGs (were saved at the project root by the harness when pasted into chat) with a temporarily-installed `sharp`:
  - `src/assets/hero-mobile.webp` (900×900) — the square badge image (fork-pin logo, "RockyEats" wordmark, "LOCAL FOOD. YOUR WAY." tagline, dine-in/delivery/pickup icon row, "PUERTO PEÑASCO, SONORA" — all already baked into the image), bottom 15% faded to transparent so it blends into the page background.
  - `src/assets/hero-desktop.webp` (1800×508) — the wide banner, cropped to end right after the "RockyEats" wordmark (excludes the baked-in Spanish-only CTA strip + a fake phone-mockup/food-photo section that doesn't match our real UI), with the bottom ~40% faded to transparent for the same blend-into-page effect.
  - The wordmark-on-glow reference (`Title.png`) turned out to have real alpha transparency at the extreme edges but a soft golden vignette baked into the interior (not a clean cutout) — decided against using it directly; the badge/banner images already contain a clean wordmark, so this asset wasn't needed.
  - Source PNGs and all intermediate crop/fade test files were deleted after producing the final WebP assets (they were multi-MB and not meant to live in the repo).
  - `sharp` was installed/uninstalled with `--no-save` again (one-off tool, not a project dependency).
- `SESSION_LOG.md` (this file) created per user request, so progress is readable across devices/accounts via `git pull`.

**Not done yet — next steps:**
1. Wire `hero-mobile.webp` / `hero-desktop.webp` into `RestaurantList.jsx` (responsive: mobile shows the square badge hero, desktop shows the wide banner hero — e.g. via Tailwind `sm:hidden` / `hidden sm:block` on two `<img>`s, or a `<picture>` with a media-query source).
2. Below the hero, rebuild in real (translatable, functional) HTML what the banner's cropped-out bottom strip showed: the "LOCAL FOOD. YOUR WAY." tagline, and a Dine-in/Delivery/Pickup/"Pay your way" icon row (the reference included a 4th "PAGA COMO QUIERAS" item with a WhatsApp icon covering cash/transfer/card terminal — consider adding as a trust-building row, not a functional control).
3. Add a functional search bar ("¿Qué se te antoja hoy?" / "What are you craving today?") filtering the restaurant list by name — seen in the banner's phone-mockup concept art, not yet built for real.
4. Consider making the Dine-in/Delivery/Pickup icons on the home page actual filters (toggle to filter restaurants by `supports_dine_in`/`supports_delivery`/`supports_pickup`) rather than purely decorative, since the reference shows them prominently on the home screen (currently these mode-picker buttons only exist per-restaurant on the menu page, not on the home/list page).
5. Shift the `dusk-*` color tokens in `src/index.css` from purple (`#241536` etc.) to navy (closer to the brand's near-black navy blue used in the badge/wordmark outline) — the rest of the palette (sunset orange, ocean teal) already closely matches the brand; navy was the one clear mismatch. Add matching translation keys (`home.search`, `home.searchPlaceholder`, `home.payYourWay`, etc.) to `src/lib/translations.js` for whatever new strings get added.
6. Apply the same visual language (hero treatment, tighter brand colors) to the header wordmark styling if it still looks generic next to the new hero.

**Why paused:** user needs to switch devices mid-task. Everything up to and including the two hero WebP assets is committed and pushed to `main` so it's available via `git pull` on the other device — just not yet wired into any component.

## 2026-07-30 — Spanish/English language picker

- `LanguageContext` + `src/lib/translations.js` dictionary, first-visit full-screen picker (`LanguagePicker`), ES/EN toggle in the customer header.
- Only the customer-facing flow is translated (dashboard/admin stay as-is — that's for the business, not requested).
- The WhatsApp message sent *to* the restaurant stays fixed in Spanish regardless of the customer's UI language choice, since it's addressed to a local Spanish-speaking business owner, not the customer.

## 2026-07-30 — Ambient background + polish

- Soft blurred sunset/ocean color blobs + a faint blurred logo watermark added in `ClientLayout`, visible across all customer pages.

## 2026-07-30 — Item notes, sales report, queue board

- **Item notes**: cart line items got a free-text "special instructions" field (`order_items.notes` column, migration `20260730140000_order_item_notes.sql`). Shown on checkout confirmation and flagged with ⚠️ on the restaurant's Orders page.
- **Sales report** (`/dashboard/sales`): stat tiles (15-day revenue, items sold, daily average) + a hand-rolled bar chart of daily revenue, aggregated client-side from `orders`/`order_items` (excludes cancelled orders).
- **Queue board** (`/dashboard/queue`): dark TV/bank-style display, 3 columns (Nuevo → Preparando → Listo), tap a tile to advance status; tapping in "Listo" marks the order completed. Realtime-driven like the Orders page.
- Admin: restaurants can now be hard-deleted (not just deactivated) — blocked by FK constraints (existing orders / assigned owner) with a friendly error explaining why, deactivate remains the fallback.
- WhatsApp "notify the restaurant" button now shows on **every** order confirmation (not just bank transfer), prefilled with full order details. True automatic server-push notifications would need the paid WhatsApp Business Cloud API + a backend endpoint — out of scope for now, flagged as a future option if it's ever worth the lift.

## 2026-07-30 — Customer-facing flow (cart → checkout → WhatsApp)

Full build: sunset/ocean Tailwind v4 theme (custom fonts via Google Fonts, `@theme` color tokens), `CartContext` (localStorage-persisted, one restaurant at a time), restaurant list → menu (with order-mode picker) → cart → checkout (name/phone/payment method) → confirmation page. Bank transfer orders show the restaurant's bank details + WhatsApp deep link with the order number prefilled, per the original spec.

Migrations 5–6 (`admin_lookup_user_id_by_email`, `admin_list_profiles`) were also applied in this session, after some friction — see "known quirks" below.

## 2026-07-30 — Restaurant dashboard + Admin panel

- Auth: shared login (email/password), role-based redirect, `ProtectedRoute` guarding `/dashboard` (restaurant_owner) and `/admin` (admin).
- Dashboard: live order feed (Supabase Realtime), status + payment-confirmed controls, menu item CRUD with availability toggle.
- Admin: restaurant CRUD, user/role assignment by email (via `admin_lookup_user_id_by_email` RPC, since the client can't query `auth.users` directly).

## 2026-07-30 — Initial scaffold + database schema

- Vite + React 19 + Tailwind v4 SPA, Supabase-direct (no separate backend — RLS does all the access control). Three route trees in one app: `/` (public customer), `/dashboard/*` (restaurant owner), `/admin/*` (admin).
- Full schema live in Supabase project `fvkzmfbopvhhvzgwnenx`: `profiles` (role + restaurant scoping), `restaurants`, `menu_items`, `orders`, `order_items`, with RLS enforcing the three access tiers and a Postgres-side human-readable order number generator (`A1234` style).
- Pushed to GitHub: `HenriZav1019/RockyEats`, `main` branch.

---

## Known quirks worth remembering

- **Supabase SQL Editor paste corruption**: multi-line pastes into the dashboard's SQL editor have repeatedly gotten mangled (stray characters, truncated pastes). Fix: flatten migrations to single-line statements when handing them over for manual paste, and always paste into a fresh "New query" tab.
- **Bootstrap steps that need the Supabase dashboard directly** (can't be done from the app, by design — RLS requires an admin to already exist): creating the very first admin `profiles` row, and creating any new Auth user (restaurant-owner or admin login) — the client never gets `service_role` access, so new logins are created via Authentication → Add user in the dashboard, then assigned a role via `/admin/users`.
