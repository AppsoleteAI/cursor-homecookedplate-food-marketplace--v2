# Payment confirmation and receipt

Web, iOS, and Android use the same source. The website publish on `main` includes this UI on https://homecookedplate.com and https://homecookedplate.pages.dev. The next store build picks up the same source on iOS and Android.

## Review accounts

The Apple review demo account and the Google review demo account are the only Premium exceptions, and only so those two stores can approve the app. This repo does not store their emails or passwords. No other account can claim that exception. A signed-in person cannot write their own membership or payment columns. Early Bird remains the PlateMaker trial already in the app. It is not a review exception.

## What the PlateMaker is sent

A PlateMaker is sent a plate only after Stripe has confirmed the charge and the amount matches that cook's prices, the service fee, and any delivery fee. Incoming orders, the cook's order list, and kitchen earnings all leave unpaid plates out. A shop order reaches the cook only after that same Stripe confirmation. The cook is not notified of an unpaid checkout.

A PlateTaker still sees their own unpaid checkout so they can finish paying. Signed out, neither role is sent an order.

## Other charge paths

A smaller succeeded charge cannot be reused on a larger plate, a shop order, or a combined checkout. Each of those checks the Stripe amount against the server price before anything is marked paid. The cook's ready step also refuses an unpaid plate.

A plate price is the price the PlateMaker saved on the meal. Checkout charges that price plus the service fee, and the delivery fee when the cook set one. A shop price is the price on that shop's menu. Membership on the web is $4.99 a month or $39.99 a year for a PlateMaker, and $7.99 a month or $75.99 a year for a PlateTaker. The phone source asks Apple and Google for that same role price. PlateMaker products stay `membership.monthly` at $4.99 and `membership.annual` at $39.99. PlateTaker products are `platetaker.monthly` at $7.99 and `platetaker.annual` at $75.99. Play already lists the PlateTaker products. Apple still has to list them. Binaries through 1.0.0 (10) were compiled before this and still buy the PlateMaker products for a PlateTaker. This note is local.

## PlateMaker, signed in

A cook sees an incoming plate only after Stripe has marked it paid. Accept checks the Stripe payment again and checks that the charge matches the plate prices. An unpaid order is not a purchase.

The cook marks the plate ready for pickup. The clear control stays hidden until the PlateTaker has sent the receipt acknowledgment. The cook then checks "I acknowledge these food item(s) were paid for and the PlateTaker received them." and presses Send. The order closes only after that send. The same checkbox and Send are on a paid shop order after the PlateTaker acknowledges it.

## PlateTaker, signed in

The app stays free. Premium starts after Stripe, Apple, or Google reports an active membership. An unfinished Stripe subscription does not turn Premium on. A saved Stripe subscription id is checked with Stripe on sign-in and is cleared when Stripe does not report it active or trialing.

A plate is created unpaid. It becomes paid only when Stripe reports the charge succeeded and the amount matches the cook's prices. The buyer cannot attach a smaller charge to a larger order.

When the plate is ready, the buyer checks "I acknowledge these food item(s) were paid for and I received them." and presses Send. Both roles also see: "Both the PlateMaker and the PlateTaker must acknowledge that the food item(s) were paid for and received." The cook cannot clear the order before that send. The same acknowledgment is on a paid shop order after the cook has accepted it.

## Signed out

There is no purchase, no Premium, and no receipt acknowledgment. Membership prices on the public page stay the same for both roles. The review accounts are not available signed out.

## Membership column lock

This lock is live. On 3 November 2026 the SQL editor returned one row: `protect_membership_columns_trigger` on `profiles`. On 6 November 2026 the same statement was run again and the editor returned Success with no rows. That is the result for a function and a trigger. Do not run it again. A signed-in PlateMaker or PlateTaker cannot write their own membership, subscription, payout, `metro_area`, `two_factor_enabled`, or `is_paused` columns. Signup and Get GPS still write `metro_area` with the service role. The Worker can still record a payment Stripe, Apple, or Google confirmed.

```sql
CREATE OR REPLACE FUNCTION public.protect_membership_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  locked text[] := ARRAY[
    'membership_tier',
    'stripe_subscription_id',
    'stripe_customer_id',
    'stripe_account_id',
    'trial_ends_at',
    'trial_started_at',
    'apple_original_transaction_id',
    'apple_expires_at',
    'apple_revoked_at',
    'apple_auto_renew',
    'apple_checked_at',
    'google_purchase_token',
    'google_expires_at',
    'google_checked_at',
    'is_admin',
    'role',
    'selling_removed',
    'ordering_removed',
    'dispute_fee_owed_cents',
    'kitchen_permit',
    'metro_area',
    'two_factor_enabled',
    'is_paused'
  ];
  column_name text;
  old_row jsonb := to_jsonb(OLD);
  new_row jsonb := to_jsonb(NEW);
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' AND auth.role() IS DISTINCT FROM 'anon' THEN
    RETURN NEW;
  END IF;
  FOREACH column_name IN ARRAY locked LOOP
    IF old_row ? column_name AND new_row ? column_name AND (old_row -> column_name) IS DISTINCT FROM (new_row -> column_name) THEN
      RAISE EXCEPTION 'This account cannot change membership or payment columns';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_membership_columns_trigger ON public.profiles;
CREATE TRIGGER protect_membership_columns_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_membership_columns();
```

## Final receipt

The final receipt opens after the order status is completed. That is after the PlateTaker and the PlateMaker have both acknowledged that the food was paid for and received. Signed in, a PlateTaker sees “You pay” and a PlateMaker sees “You receive.” Both see the base, the buyer fee, the seller fee, what the buyer paid, and what the cook receives. Those amounts come from `finalPlateReceipt` in `backend/lib/fees.ts`. The base is `order.total_price`. A PlateTaker Premium plan pays 5% when that base is $20 or more. The cook’s 10% stays. Signed out, neither role can open it. Another account cannot open it. Web, iOS, and Android use the same source.

A message on the order waits until the order is paid. The payment notice still tells the PlateMaker when Stripe marks it paid. After that, the PlateTaker can write the cook. The PlateMaker can send an ETA of 5 to 240 minutes. A moderator allows the message before the other person is told. An ETA notice is titled Order ETA. Signed out, neither role can send one.

## Orders already open

A plate the cook already confirmed under the older pickup step still waits for the PlateTaker. When the PlateTaker sends the acknowledgment, that order can close.

## Scale mail and the cook's Stripe account

Signed in, a paid plate emails the PlateMaker by default. Accept, ready, and pickup email the PlateTaker by default. The ready step on the cook's other path sends that same ready mail. Turning email off stops the mail and leaves the in-app notice.

A held payout stays held until that PlateMaker finishes their own Stripe account. A PlateTaker has no payout. Signed out, neither role is paid and neither role is emailed an order.

When selling is removed, new orders stop. Held cook payouts wait until 30 days after that removal, then transfer to that cook’s Stripe account. A sale already marked disputed stays out of that transfer. Fees still owed, including a $15 lost-dispute fee, are taken out of the transfer. The 10% buyer fee, the 10% cook fee, and the 10% on a delivery fee stay on the platform because they were never part of the cook share. An admin can restore selling before that date. Restoring clears the 30-day clock. A PlateTaker ban for lost disputes does not pay the cook and does not start this clock. Signed out, there is no removal and no final payout. Web, iOS, and Android use the same source.

On 8 November 2026 the SQL editor ran `backend/sql/final_payout_after_ban.sql` and returned Success with no rows. That is the result for adding `profiles.final_payout_at` and replacing `protect_membership_columns`. Do not run it again. A signed-in PlateMaker cannot write that date. The Worker can. A PlateTaker has no final payout date. Signed out, neither role has one.

The Worker that sets that date was deployed 8 November 2026. Version `da4d1476-55dc-4fba-973f-ade624f0463e`. The earlier same-day version `f12c11b4-d5eb-4846-b202-10c69509d49d` went out before this settlement was in the source. Five checks of `/` and `/health` each returned 200. Signed in, a removed PlateMaker’s remaining payout is scheduled from this Worker. A PlateTaker still receives no payout. Signed out, neither role is paid. Web, iOS, and Android use this Worker. The iOS and Android store builds stay on the previous copy until a new build.

The 5 November 2026 check did not charge a live card. A signed-in PlateTaker on a phone still has no finished live-card pass. Checkout still refuses a cook who has not finished Stripe. Web, iOS, and Android use the same source. The website publish on `main` includes the final receipt and ETA screens.

## Checkout return

A membership charge, a plate charge, a shop charge, and a combined charge can return only to HomeCookedPlate. Localhost is refused. Another website is refused before Stripe opens. A shop or combined return path has to be a path on that same site. Signed in, a PlateTaker and a PlateMaker on the website use that return. On a phone, membership uses the store and does not send a return page. Signed out, checkout does not open. Web, iOS, and Android use the same source. `plate-marketplace-api` was deployed 11 November 2026. Version `c30c059c-70b8-4ad6-9f83-d87959649fcd`. Five checks of `/` and `/health` each returned 200. Health reported the database connected.

## Order steps

On 11 November 2026 the SQL editor ran `backend/sql/hold_moderated_text.sql` and returned Success with no rows. That is the result for the functions, the triggers, and the column locks. Do not run it again. A signed-in PlateTaker or PlateMaker cannot delete an order or skip Accept, Ready, or the two pickup acknowledgements. A paid accept, a ready step, and a completed step stay available to the person who already had that step. Signed out, there is no order row to change. Web, iOS, and Android use the same source. The Worker that reads a held note was deployed 11 November 2026. Version `c30c059c-70b8-4ad6-9f83-d87959649fcd`. A PlateMaker accept and a PlateTaker review list use this Worker.

## Webhook compare and the checked-in order policy

The Stripe webhook still checks the signature and the 5-minute timestamp. The signature compare is constant-time. The metro webhook secret uses that same compare. Signed in, a PlateTaker's paid plate and a PlateMaker's payout notice still depend on that webhook. Signed out, neither role sends it. This change is in the Worker source. It is local until that Worker is deployed. This turn did not deploy.

On 6 November 2026 the live `orders` table has `platetaker_id`, `platemaker_id`, and `total_price_cents`. It has no `buyer_id`, `seller_id`, `paid`, or `total_price`. `backend/sql/rls_policies.sql` and `backend/sql/complete_setup.sql` now use those live columns. A new order row is allowed only when `platetaker_id` is the signed-in account, `payment_intent_id` is empty, and `status` is `pending`. The price trigger writes `total_price_cents`. `Platemakers view incoming`, `Platetakers view history`, and `session_completed_second_factor` are not dropped. Signed in, a PlateTaker can insert that unpaid pending row for themselves and can read their history. A PlateMaker can read incoming rows where `platemaker_id` is that cook, and cannot insert an order. Signed out, neither role matches. Web, iOS, and Android use the same source.

On 7 November 2026 the SQL editor finished that script with Success and no rows. A follow-up catalog returned 7 policies on `orders`. `Platemakers view incoming` is select on `platemaker_id`. `Platetakers view history` is select on `platetaker_id`. `session_completed_second_factor` is still restrictive for every command. `insert_order_buyer` is an insert policy. Its using expression is empty, which is how an insert rule is stored. The check is `platetaker_id` equals the signed-in account, `payment_intent_id` is empty, and `status` is `pending`. `select_orders_buyer_or_seller`, `update_order_buyer_or_seller`, and `delete_order_buyer_or_seller` match the signed-in account on `platetaker_id` or `platemaker_id`. The admin-named policies from `complete_setup.sql` are not in this catalog. Signed in, a PlateTaker can insert that unpaid pending row and can read, update, and delete a row where `platetaker_id` is that account. A PlateMaker can read incoming rows and can update or delete a row where `platemaker_id` is that cook. A PlateMaker cannot insert an order. Signed out, neither role matches. Web, iOS, and Android use the same source. This catalog is the 7 November read. On 11 November 2026 `backend/sql/hold_moderated_text.sql` removed delete for a signed-in account and locked the note and comment columns. Do not run it again.

On 11 November 2026 a later catalog of `orders` returned `payment_intent_id`, `platemaker_id`, `platetaker_id`, `status`, and `total_price_cents`. `seller_id` and `paid` were not in that result. Accept and Ready read the cook from `platemaker_id` and update that column. A signed-in PlateMaker is matched on that cook id. A signed-in PlateTaker is still the buyer on the notice. Signed out, neither role can accept or mark ready. Web, iOS, and Android use the same Worker source. `plate-marketplace-api` was deployed 12 November 2026. Version `46638363-81c7-42ce-8306-3b54aed091a8`. Five checks of `/` and `/health` each returned 200.

On 12 November 2026 Accept and Ready treat a plate as paid when `paid` is true. When that column is absent, the plate is paid when Stripe reports `succeeded` for `payment_intent_id`, or when `transactions` has that `order_id` in `held` or `settled`. `paid` set to false stays unpaid. A missing `paid` column is not an unpaid plate. Accept still checks that a succeeded Stripe charge covers the plate prices. A held or settled transaction with no succeeded charge does not run that amount check. Ready uses the same paid rule before it writes `ready`, and it does not re-check the amount. Accept still moves only `pending` to `accepted`. Ready still moves only `accepted` or `preparing` to `ready`. No `paid` or `seller_id` column was added. Signed in, a PlateMaker can accept and mark ready on that proof. A signed-in PlateTaker receives the accept and ready notices and cannot take those steps. Signed out, neither role can. Web, iOS, and Android call this Worker, so the installed phone apps use this step without a new store build. `plate-marketplace-api` was deployed 12 November 2026. Version `10005c24-9cf5-4772-bff3-be1dd5a7ad36`. Five checks of `/` and `/health` each returned 200. Health reported the database connected at `2026-11-12T05:23:05.719Z`. On 12 November 2026 the incoming list, the cook order list, Deny, Refund, order status update, the cook dashboard totals, the final receipt, a PlateTaker block, order messages, and a completed-order review read the cook from `platemaker_id` when `seller_id` is absent. Unpaid plates stay off the cook list. When `paid` is absent, a plate stays on that list, and a message can be sent, when Stripe reports `succeeded` or `transactions` has that order in `held` or `settled`. A cancel does not write `paid` when that column is absent. The cook dashboard sums `total_price_cents` through `sellerTakeHome` in `backend/lib/fees.ts`. Signed in, a PlateMaker sees incoming paid plates and can deny, refund, move status, or message. A signed-in PlateTaker still sees an unpaid checkout, sees a paid plate as paid, can cancel a paid pending plate with a card refund, can open the final receipt after both acknowledgements, can message on a paid plate, and can review a completed plate. Signed out, neither role can. Web, iOS, and Android call this Worker, so the installed phone apps use this step without a new store build. `plate-marketplace-api` was deployed 12 November 2026. Version `920f477b-d4de-49f5-a246-4c4357ed272b`. Five checks of `/` and `/health` each returned 200. Health reported the database connected at `2026-11-12T05:37:06.803Z`.

On 12 November 2026 that same Worker is the publish for Accept and Ready. The 11 November catalog of `orders` is `payment_intent_id`, `platemaker_id`, `platetaker_id`, `status`, and `total_price_cents`. `buyer_id`, `seller_id`, `paid`, and `total_price` were not in that result. The deploy left the existing secrets in place. Do not run `backend/sql/hold_moderated_text.sql` again. Signed in, a PlateMaker opens an incoming paid plate, presses Accept, then Ready. A signed-in PlateTaker sees `accepted`, then `ready`. Signed out, neither role can call these routes. Web, iOS, and Android call this Worker. The installed phone apps do not need a new store build: Accept calls `platemaker.acceptOrder`, and Ready calls `orders.updateStatus`. Version `920f477b-d4de-49f5-a246-4c4357ed272b`. Five checks of `/` and `/health` on this confirmation each returned 200. Health reported the database connected at `2026-11-12T06:01:57.261Z`.

On 12 November 2026 a new plate insert follows the live columns. The first try uses `buyer_id`, `seller_id`, `total_price`, and `paid`. When the database says one of those is missing, the insert uses `platetaker_id`, `platemaker_id`, and `total_price_cents`, and it leaves `paid` off. Combined checkout uses that same insert. Linking a card drops `.eq('paid', false)` when `paid` is missing, and the cook check uses `platemaker_id`. A missing `paid` column does not reject the payout record. Portion counts use a held or settled transaction when `paid` is absent. Signed in, a PlateTaker can place a plate and pay it. A signed-in PlateMaker is that plate's cook, and an open paid plate still keeps the kitchen during closeout. Finishing Apple or Google sign-in and deleting an account read `platetaker_id` and `platemaker_id` when the older columns are missing. Signed out, none of these run. Web, iOS, and Android call this Worker, so the installed phone apps place and pay through this step without a new store build. `plate-marketplace-api` was deployed 12 November 2026. The insert returns only the new row id, and the place response uses the request values for the meal, pickup, and note. Version `c23ebdf4-72c9-4836-939b-d7f84a9b44ef`. Five checks of `/` and `/health` each returned 200. Health reported the database connected at `2026-11-13T00:11:52.152Z`. No `seller_id` or `paid` column was added. Do not run `backend/sql/hold_moderated_text.sql` again.
