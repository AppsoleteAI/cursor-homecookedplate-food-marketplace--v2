# Account identifiers

Web, iOS, and Android use the same source. The website publish on main serves these codes. An installed app keeps the previous profile until the next store build.

A PlateMaker code starts with `PM-`. A PlateTaker code starts with `PT-`. The code is stored on that account and in `account_identifiers`. One code belongs to one account. Creating another account mints a new code. Deleting an account leaves the old code reserved, so it is not given out again.

Stripe Connect accounts and Stripe customers follow the same rule in `stripe_identity_claims`. A cook’s `stripe_account_id` and a buyer’s `stripe_customer_id` cannot be saved onto a second account. A new account gets a new Stripe record when it needs one.

## PlateMaker

Signed in, signup and Apple or Google finish assign the code. The profile screen shows PlateMaker ID. Payouts and responsibility shows the same code. Selling stays closed until Stripe reports `payouts_enabled`. A removed cook is not offered a new code. The remaining payout still waits for the 30-day final date already on that account.

Signed out, no code is created and no Stripe account is created.

## PlateTaker

Signed in, signup and Apple or Google finish assign the code. The profile screen shows PlateTaker ID. Checkout uses that account’s own Stripe customer. A customer id sent from the phone is ignored unless it is already saved on this account. The buyer does not receive a Connect account or a Transfer.

Signed out, no code is created and no charge is created.

`backend/sql/account_identifiers.sql` was run in the SQL editor on 8 November 2026. The editor returned Success with no rows. Do not run it again. A signed-in account receives its code on the next `auth.me`.
