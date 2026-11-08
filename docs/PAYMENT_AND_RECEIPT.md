# Payment confirmation and receipt

Web, iOS, and Android use the same source. The website publish on `main` includes this UI on https://homecookedplate.com and https://homecookedplate.pages.dev. The next store build picks up the same source on iOS and Android.

## Review accounts

The Apple review demo account and the Google review demo account are the only Premium exceptions, and only so those two stores can approve the app. This repo does not store their emails or passwords. No other account can claim that exception. A signed-in person cannot write their own membership or payment columns. Early Bird remains the PlateMaker trial already in the app. It is not a review exception.

## What the PlateMaker is sent

A PlateMaker is sent a plate only after Stripe has confirmed the charge and the amount matches that cook's prices, the service fee, and any delivery fee. Incoming orders, the cook's order list, and kitchen earnings all leave unpaid plates out. A shop order reaches the cook only after that same Stripe confirmation. The cook is not notified of an unpaid checkout.

A PlateTaker still sees their own unpaid checkout so they can finish paying. Signed out, neither role is sent an order.

## Other charge paths

A smaller succeeded charge cannot be reused on a larger plate, a shop order, or a combined checkout. Each of those checks the Stripe amount against the server price before anything is marked paid. The cook's ready step also refuses an unpaid plate.

A plate price is the price the PlateMaker saved on the meal. Checkout charges that price plus the service fee, and the delivery fee when the cook set one. A shop price is the price on that shop's menu. Membership on the web is $4.99 a month or $39.99 a year for a PlateMaker, and $7.99 a month or $75.99 a year for a PlateTaker. Apple and Google still sell the two store products already in review, `membership.monthly` and `membership.annual`. Those store charges are $4.99 and $39.99 for both roles until PlateTaker products exist in the stores and a later build requests them.

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

When selling is removed, new orders stop. Held cook payouts wait until 30 days after that removal, then transfer to that cook’s Stripe account. A sale already marked disputed stays out of that transfer. Fees still owed, including a $15 lost-dispute fee, are taken out of the transfer. The 10% buyer fee, the 10% cook fee, and the 10% on a delivery fee stay on the platform because they were never part of the cook share. An admin can restore selling before that date. Restoring clears the 30-day clock. A PlateTaker ban for lost disputes does not pay the cook and does not start this clock. Signed out, there is no removal and no final payout. Web, iOS, and Android use the same source. This change is local until the Worker is deployed and `backend/sql/final_payout_after_ban.sql` has been run in the SQL editor.

The 5 November 2026 check did not charge a live card. A signed-in PlateTaker on a phone still has no finished live-card pass. Checkout still refuses a cook who has not finished Stripe. Web, iOS, and Android use the same source. The website publish on `main` includes the final receipt and ETA screens.

## Webhook compare and the checked-in order policy

The Stripe webhook still checks the signature and the 5-minute timestamp. The signature compare is constant-time. The metro webhook secret uses that same compare. Signed in, a PlateTaker's paid plate and a PlateMaker's payout notice still depend on that webhook. Signed out, neither role sends it. This change is in the Worker source. It is local until that Worker is deployed. This turn did not deploy.

On 6 November 2026 the live `orders` table has `platetaker_id`, `platemaker_id`, and `total_price_cents`. It has no `buyer_id`, `seller_id`, `paid`, or `total_price`. `backend/sql/rls_policies.sql` and `backend/sql/complete_setup.sql` now use those live columns. A new order row is allowed only when `platetaker_id` is the signed-in account, `payment_intent_id` is empty, and `status` is `pending`. The price trigger writes `total_price_cents`. `Platemakers view incoming`, `Platetakers view history`, and `session_completed_second_factor` are not dropped. Signed in, a PlateTaker can insert that unpaid pending row for themselves and can read their history. A PlateMaker can read incoming rows where `platemaker_id` is that cook, and cannot insert an order. Signed out, neither role matches. Web, iOS, and Android use the same source.

On 7 November 2026 the SQL editor finished that script with Success and no rows. A follow-up catalog returned 7 policies on `orders`. `Platemakers view incoming` is select on `platemaker_id`. `Platetakers view history` is select on `platetaker_id`. `session_completed_second_factor` is still restrictive for every command. `insert_order_buyer` is an insert policy. Its using expression is empty, which is how an insert rule is stored. The check is `platetaker_id` equals the signed-in account, `payment_intent_id` is empty, and `status` is `pending`. `select_orders_buyer_or_seller`, `update_order_buyer_or_seller`, and `delete_order_buyer_or_seller` match the signed-in account on `platetaker_id` or `platemaker_id`. The admin-named policies from `complete_setup.sql` are not in this catalog. Signed in, a PlateTaker can insert that unpaid pending row and can read, update, and delete a row where `platetaker_id` is that account. A PlateMaker can read incoming rows and can update or delete a row where `platemaker_id` is that cook. A PlateMaker cannot insert an order. Signed out, neither role matches. Web, iOS, and Android use the same source. This catalog is the live database.
