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

This lock is live. On 3 November 2026 the SQL editor returned one row: `protect_membership_columns_trigger` on `profiles`. A signed-in PlateMaker or PlateTaker cannot write their own membership, subscription, or payout columns. The Worker can still record a payment Stripe, Apple, or Google confirmed. The statement that created it is below and in `backend/sql/protect_membership_columns.sql`.

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
    'kitchen_permit'
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

## Orders already open

A plate the cook already confirmed under the older pickup step still waits for the PlateTaker. When the PlateTaker sends the acknowledgment, that order can close.
