# Production scale

The production-readiness list is split into phases. A phase is finished when the code for it is in this repo and the check named under it passes. Web, iOS, and Android use the same source. This note is local. It does not deploy the Worker.

Signed in and signed out are separate. A PlateMaker outcome and a PlateTaker outcome are separate.

The database is already on Supabase Pro, compute size Micro. Upgrades wait until that limit is reached and app revenue covers the cost. That rule is in `docs/CAPACITY_LIMITS.md`.

## Phase 1 — public read columns

Completed in this repo. Check: `backend/lib/__tests__/public-read.test.ts`.

`listMeals`, `getMeal`, and `listReviews` read named columns. The plate list still returns the same plate fields. The plate page still returns the expiry date and the receipt date. The review list still returns the comment and its moderation status.

The Worker keeps using the HTTPS Data API. It does not open a Postgres connection to the pooler.

### PlateMaker

Signed in, the cook's own plate list uses the same named columns. Stars and review counts on those plates stay. Signed out, that list is not loaded.

### PlateTaker

Signed in, home, search, filter, and the funnel use the same plate list. The plate page and its reviews use the named columns. A paused cook or a cook who turned orders off is still left off that menu. Signed out, a plate link still does not open. Signed out, the review list can still be requested. It returns the same review fields.

## Phase 2 — request size

Completed in this repo. Check: `backend/lib/__tests__/body-limit.test.ts`.

Ordinary JSON over 10 MB is refused with 413. The Worker log line is `BODY_TOO_LARGE` and includes the running count. The log does not include the address or the body.

A meal photo, a profile photo, a meal video, and a clip are base64 inside JSON. Those three routes use a higher ceiling: the existing 50 MB video check, encoded as base64, plus 64 KB for the JSON envelope. The file checks stay where they are. A meal image is still 10 MB. A profile image is still 5 MB. A video or a clip is still 50 MB.

### PlateMaker

Signed in, publishing a plate photo or a plate video uses `media.upload`. A photo at the 10 MB file check fits the upload ceiling and does not fit the 10 MB JSON ceiling. A video at the 50 MB file check fits the upload ceiling. Posting a clip uses `clips.publish` and the same upload ceiling. A kitchen, order, or checkout call over 10 MB is refused. Signed out, those upload routes still use the upload ceiling, and the account check still refuses the call. A signed-out order or sign-in body over 10 MB is refused.

### PlateTaker

Signed in, a profile photo uses `media.uploadProfile`. A photo at the 5 MB file check fits the 10 MB JSON ceiling and the upload ceiling. Posting a clip uses the same upload ceiling as a cook. Home, checkout, and messages over 10 MB are refused. Signed out, a profile photo or a clip still meets the upload ceiling before the account check. Any other signed-out body over 10 MB is refused.

## Phase 3 — request id

Completed in this repo. Check: `backend/lib/__tests__/request-id.test.ts`.

Each Worker call gets a new id in the `x-request-id` response header. The id is created on the Worker. A value sent by the client is not used. The log writes that id on a 429, on a 413, on a sign-in refusal when the limiter is not bound, and on a failed plate list, plate page, or review list. A plate that is simply missing is not a failed read. The log does not include the address.

### PlateMaker

Signed in, a kitchen call, an order call, and the cook's own plate list each get their own id. A limited kitchen call and a refused body write that id. A failed read of the cook's plate list writes it too. Signed out, sign-in and the public pages get an id. A limited or refused signed-out call writes that id. The cook's plate list is not loaded.

### PlateTaker

Signed in, home, search, filter, the funnel, the plate page, and reviews each get an id. A failed read of that menu, that plate, or those reviews writes it. A missing plate does not. Signed out, the same header is on the public pages and on sign-in. A plate link still does not open.

## Phase 4 — KV binding check

Completed in this repo. Check: `backend/lib/__tests__/rate-limit.test.ts`.

A production Worker logs `RATE_LIMIT_UNBOUND` once per isolate when `API_RATE_LIMIT` is missing, and once when `AUTH_RATE_LIMIT` is missing. The log includes the request id and does not include the address. A local Worker does not log that line. A bound limiter does not log it again.

The memory fallback stays. Ordinary kitchen, home, and checkout calls do not write KV. Sign-in in production still returns 503 when both `AUTH_RATE_LIMIT` and `RATE_LIMIT_KV` are missing.

### PlateMaker

Signed in, a kitchen or order call uses the shared API limiter. When that binding is missing, the first production call logs it and later calls on that isolate are counted in memory. Those calls do not write KV. Signed out, sign-in uses the auth limiter. A missing `AUTH_RATE_LIMIT` is logged once. Sign-in stays refused when the KV binding is missing too.

### PlateTaker

Signed in, home, search, and checkout use that same API limiter and the same one-time log. Those calls do not write KV. Signed out, sign-in is the same auth check as a cook. A missing auth binding is logged once, and sign-in stays refused when KV is missing too.

## Phase 5 — index file

Completed in this repo. Check: `backend/lib/__tests__/query-indexes.test.ts`.

`backend/sql/add_query_indexes.sql` adds the composite and partial indexes that are not already in `backend/sql/`. The single-column indexes, the metro index, the transaction date index, and the geofence active index stay as they are. The SQL editor returned success with no rows on 7 November 2026.

### PlateMaker

Signed in, the cook's own published plates use `idx_meals_cook_menu`. Incoming paid orders use `idx_orders_cook_paid_created` when `paid` exists, and `idx_orders_cook_created` when it does not. The cook column is `seller_id` when that column exists, and `platemaker_id` when it does not. Reviews on a plate and the bell use the new review and notification indexes. Signed out, the cook's order list is not loaded. The public menu indexes still apply to a signed-out menu read.

### PlateTaker

Signed in, home, search, filter, and the funnel use `idx_meals_menu_created`. A cuisine filter uses `idx_meals_menu_cuisine`. A category filter uses `idx_meals_menu_category`. The buyer's orders use `idx_orders_buyer_created` on `buyer_id`, or on `platetaker_id` when `buyer_id` is absent. Reviews and the bell use the same indexes as a cook. Signed out, a plate link still does not open. A signed-out menu read uses the same published-and-available indexes.

## Phase 6 — per-account request limit

Completed in this repo. Check: `backend/lib/__tests__/rate-limit.test.ts`.

A signed-in account has its own 100 requests a minute on the shared API limiter. The key is the account id from the bearer token. The address limit stays 100 a minute. Sign-in stays 10 a minute per address. A signed-out call is not an account count. Ordinary calls still do not write KV. The log on an account limit is `REQUEST_LIMIT` with `scope=account` and the request id. The account id is not in the log.

### PlateMaker

Signed in, kitchen and order calls count toward that cook's 100 and toward the address 100. The same cook on a second address still shares that account 100. Signed out, sign-in stays 10 a minute per address and does not count as an account.

### PlateTaker

Signed in, home, search, and checkout count toward that buyer's 100 and toward the address 100. A second buyer on another address has a separate account count. Signed out, sign-in is the same 10 a minute address limit as a cook.

## Phase 7 — read client

Completed in this repo. Check: `backend/lib/__tests__/read-client.test.ts`.

`listMeals`, `getMeal`, and `listReviews` read through `supabaseRead`. That client uses the primary Data API URL until `SUPABASE_READ_REPLICA_URL` is an HTTPS URL. A pooler host is ignored. No replica is enabled. Profile, permit, offer, and order reads stay on the primary admin client. The anon key and the caller's token still apply, so row policies stay in place.

### PlateMaker

Signed in, the cook's own plate list uses the read client. Permit, pause, and offer checks stay on the primary. Signed out, that list is not loaded.

### PlateTaker

Signed in, home, search, filter, the funnel, the plate page, and reviews use the read client. A paused cook or a cook who turned orders off is still left off the menu by the primary profile check. Signed out, a plate link still does not open. A signed-out review list uses the same read client.

### Phase 8 — order, payment, and account columns

Completed in this repo. Check: `backend/lib/__tests__/response-columns.test.ts`.

An order list, a new order, a payment, a status change, and the paid-order record name the columns they return. A column the database says is missing, including `buyer_id`, is left out of a second read. Sign-in, the account screen, signup, a saved profile, and a role change name the profile columns they return. A missing profile column is dropped and that read runs again. The confirmation link reads `id`, `user_id`, `expires_at`, and `used_at`. Web, iOS, and Android share this Worker source. `plate-marketplace-api` was deployed 7 November 2026. Version `202d29a1-8559-4d01-8da3-58526873e797`. Five checks of `/` and `/health` each returned 200.

### PlateMaker

Signed in, incoming orders, accepting or advancing an order, and the payout account save use the named columns. The kitchen still sees the plate, the note, the pickup time, and the paid flag. Sign-in and the account screen still return the cook's role, pause, membership, and legal agreement. Signed out, incoming orders are not loaded. A signed-out person can still create an account and open the confirmation link.

### PlateTaker

Signed in, the order list, checkout, leaving an unpaid order, and the payment confirmation use the named columns. The buyer still sees the plate, the note, the address, and the total. Sign-in and the account screen still return the buyer role and the legal agreement. The buyer's own download uses the same order columns. Signed out, those orders are not loaded. A signed-out person can still create an account, confirm the email, and sign in.

### Phase 9 — unit tests in CI

Completed in this repo. Check: `lib/__tests__/unit-ci.test.ts`.

`npm test` runs the existing Jest suite. `.github/workflows/unit-tests.yml` runs that command with coverage on a pull request and on a push to `main`. The store-release and Pages workflows stay off. This run was local, on 7 November 2026, with the same command the workflow uses. The workflow file has not been pushed, so GitHub has not run it. `plate-marketplace-api` was deployed 7 November 2026. Version `202d29a1-8559-4d01-8da3-58526873e797`. Five checks of `/` and `/health` each returned 200.

Coverage is the shared `backend`, `lib`, and `pages` code. App screens are outside this count.

| | Covered |
| --- | --- |
| Statements | 34.81% (3282/9428) |
| Branches | 29.21% (2579/8829) |
| Functions | 46.95% (610/1299) |
| Lines | 35.02% (2956/8439) |

89 suites passed. 634 tests passed. The 60% target stays in Held. CI does not fail the build at 60%.

The Double 10 split from `calculateOrderSplit` is rounded to cents. A $20 plate stays $22 paid and $18 to the cook. A $32.97 plate is $36.27 paid, $29.67 to the cook, and $6.59 kept by the platform. Checkout still prices the card with `calculateFees`.

### PlateMaker

Signed in, the cook's payout from `calculateOrderSplit` is in cents on web, iOS, and Android. A stored cook profile with no session stays signed out. Signed out, the $20 example on the legal page stays $18 to the cook. The test run does not change incoming orders or the kitchen.

### PlateTaker

Signed in, the buyer's side of that split is in cents on web, iOS, and Android. A stored buyer profile with no session stays signed out. Signed out, the $20 example stays $22 paid. The test run does not change home, checkout, or the order list.

### Phase 10 — Worker timing

Completed in this repo. Check: `backend/lib/__tests__/public-read-timing.test.ts`.

`listMeals`, `getMeal`, and `listReviews` log `PUBLIC_READ` with the read name, the milliseconds, and the request id. The log has no account id and no address. One in ten of those timings is sent to the same Sentry store the Worker already uses for a crash. The account id is the only identity on that event. A signed-out read sends no identity. No DSN means the Worker log is the only record. No dashboard and no page were added. Web, iOS, and Android share this Worker source. `plate-marketplace-api` was deployed 7 November 2026. Version `202d29a1-8559-4d01-8da3-58526873e797`. Five checks of `/` and `/health` each returned 200.

### PlateMaker

Signed in, the cook's own plate list and a plate page record `listMeals` and `getMeal`. A sampled event carries that cook's account id. Signed out, incoming orders are not loaded. A public plate or review read that still runs logs the same timing with no account id.

### PlateTaker

Signed in, home, search, filter, the funnel, the plate page, and reviews record the same three timings. A sampled event carries that buyer's account id. Signed out, a plate link still does not open. A signed-out review list still logs `listReviews` with no account id.

## Held

These cannot be finished from this repo. A later phase does not reopen them.

### Database connections

- Configure the Supabase connection pooler. The Worker does not speak the Postgres wire protocol. The pooler host on port 6543 would stop every signed-in and signed-out call.
- Point the backend at pooler endpoints. Same reason. `SUPABASE_URL` stays the HTTPS Data API.
- Set 100 connections per Worker. A Worker isolate does not hold a database connection. One hundred connections times the number of isolates would exhaust the database.
- Monitor pool metrics, replica lag, and slow-query alerts from here. Those charts are on the Supabase project. This repo cannot read them.
- Enable read replicas, a second region, or a larger compute size. The project stays on Micro until revenue covers the next size. Sharding is not a plan for this database.
- Measure latency by region. That needs live traffic from each region.

### Caching and media

- Cache plate listings for 1–5 minutes. A PlateTaker would keep seeing a plate after the PlateMaker paused or turned orders off.
- Add Redis or Upstash. That is a new host and a new secret. The free Worker day is the limit that is already tracked.
- Cloudflare cache rules for API responses. The menu is per account and per metro.
- Move images to Cloudflare Images, rewrite stored URLs, or add a resize pipeline. Existing photos stay in the `meal-media` and `profile-images` buckets.

### Abuse controls that need a new vendor or a screen change

- Lower the shared limit from 100 a minute to 60. The dinner-peak check allows 100 from one address and refuses the next. Both roles share that 100.
- IP reputation, request signing, an admin IP allowlist, and a yearly key-rotation job. An allowlist would lock the admin out of a new network. Rotation is done in each vendor's dashboard when that key is due.
- hCaptcha or reCAPTCHA on signup and password reset. The screens that would show it are in the app, and this pass does not add screens. A token check with no screen would stop signup for both roles.
- A job queue, and moving mail or photos onto it. Mail already counts against 100 sends a day. A queue would not raise that number.

### Monitoring that needs an account

- PagerDuty, paging tests, and alert runbooks. KV write-cap mail already goes through the admin alert path.
- `pg_stat_statements` on the live database, custom monitoring queries run there, and growth charts. The SQL editor is the place for a one-off query. This repo does not run it.
- An analytics SDK, business dashboards, and daily or weekly report mail. The public-read timing uses the existing Sentry client. It does not add a dashboard.
- Paging on that timing. PagerDuty stays off. The Worker log and the sampled Sentry event are the record.
- Shipping logs to another host and a 30–90 day retention plan on that host. The Worker log stays on Cloudflare.

### Checks that need a phone, a card, or a second project

- End-to-end runs on staging, visual regression, and a load test. There is no staging Supabase project in this repo. Phone checks stay in `docs/PHONE_DIAGNOSTICS.md`.
- Penetration testing on a schedule.

### Coverage gate

- A 60% coverage gate. The 7 November 2026 unit run measured 35.02% of lines in `backend`, `lib`, and `pages`. App screens are outside that count. CI prints the number and does not fail the build at 60%.

### Already in the repo

Email confirmation is already required for both roles. Signup does not open a session. Sign-in stops until `email_confirmed_at` is set. Reminder mail to unverified people would spend the same 100-email day, so it stays off. Sentry performance sampling is already `0.1`.

## SQL editor, 7 November 2026, evening

The editor returned Success with no rows for the files below. Do not run them again. Web, iOS, and Android use the same source. PlateMaker and PlateTaker share this database.

- `backend/sql/allow_lifetime_device_rebind.sql`
- `backend/sql/add_kitchen_pin.sql`
- `backend/sql/add_five_metros.sql`
- `backend/sql/require_second_factor.sql`
- `backend/sql/add_moderation_queue.sql`
- `backend/sql/email_verification_tokens.sql`
- `backend/sql/add_food_safety_acknowledgment.sql`
- `backend/sql/add_platemaker_availability.sql`
- `backend/sql/add_metro_settings.sql`
- `backend/sql/add_metro_geofence_settings.sql` — the column adds are done. The seed function in that run reads `metro_name`. The live geofence city column is `name`. The function in the repo now reads `name`, then `metro_name`.
- `backend/sql/fix_metro_cap_increment.sql`
- `backend/sql/auto_create_profile.sql`
- `backend/sql/harden_open_controls.sql`
- `backend/sql/apply_shared_kitchen.sql`
- `backend/sql/payout_hold_and_responsibility.sql`
- `backend/sql/lost_disputes.sql` — this file’s `protect_selling_removed` also locks `ordering_removed` and `dispute_fee_owed_cents`. It belongs after the payout file.
- `backend/sql/add_stripe_account_id.sql`
- `backend/sql/add_payment_intent_id.sql`
- `backend/sql/lock_public_profile_and_transactions.sql`

`backend/sql/migration_add_cascade_to_profiles.sql` returned one row, `profiles_id_fkey` with `ON DELETE CASCADE`. `backend/sql/confirm_live_gates.sql` returned 7 order policies. Those two are done. They are not a no-rows result. Do not run them again.

`backend/sql/add_metro_counts_updated_at.sql` was run on 10 November 2026. The editor returned Success with no rows. Do not run it again. Create Account inside a metro and Get GPS into a named metro can write the count for a PlateMaker and a PlateTaker.

These files stay unrun. A success from one of them would fight the live `orders` columns or the 7 November order policies: `schema.sql`, `security_enhancements.sql`, `test_security.sql`, `complete_setup.sql`, `add_transactions_table.sql`, `add_revenue_summary_view.sql`, `area_offers_and_charitable_gifts.sql`, `add_metro_area_counts.sql`, `migrate_rename_count_columns.sql`, `add_metro_cap_trigger.sql`, `add_membership_schema.sql`, and `storage.sql`.

### PlateMaker

Signed in, Get GPS can store the kitchen pin, a lifetime re-download can store the new token, and a full metro does not grow past the cap. A cook message, a plate note, and a review comment wait for a moderator. The cook’s availability and food-safety acknowledgement can be stored. Signed out, none of these writes run.

### PlateTaker

Signed in, home uses the cook pin for the 20-mile list, a lifetime re-download can store the new token, and an order message waits for a moderator. A verified authenticator factor still requires the finished code. Signed out, none of these writes run.
