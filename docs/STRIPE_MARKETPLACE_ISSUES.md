# Stripe marketplace issues

Resolved in the shared source. Web, iOS, and Android use that source. `plate-marketplace-api` was deployed 8 November 2026. Version `623df7e0-d9f9-4275-b97b-da82a2dc9608` is the deploy where `platetaker` listens to 12 events. The current Worker is version `f12c11b4-d5eb-4846-b202-10c69509d49d`.

Money stays in `backend/lib/fees.ts`. A $20 plate is $22 from the PlateTaker, $18 to the PlateMaker, and $4 kept by HomeCookedPlate, before the card fee and any delivery fee. The charge sits on the platform. A later Transfer sends the cook share. Settled means that Transfer was created. It does not mean the money is in the cook’s bank.

## What the code does now

A signed-in PlateMaker gets one `PM-` code. A signed-in PlateTaker gets one `PT-` code. A new account gets a new code. Stripe account ids and Stripe customer ids are claimed the same way. See `docs/ACCOUNT_IDENTIFIERS.md`.

Connect onboarding uses HTTPS return and refresh URLs on the Worker. The Express account requests `transfers` only, country US. `payouts_enabled` is required before a plate can be published or a buyer can be charged. An account id alone does not open selling.

A plate hold starts when both people confirm pickup. A shop hold starts when the cook clears that shop order. If the clear never happens, the hold starts 7 days after the cook confirms a plate handoff, or 7 days after a shop charge that is still open. Then the Transfer waits 7 calendar days. Checkout copy says that.

The Transfer sends `source_transaction` for that charge. Rows that cannot be paid are moved off the front of the hourly batch. The dispute-fee balance is reduced only after the row is marked settled. A reversal asks for the cents that were transferred. A $15 lost-dispute fee is withheld from a held payout, or reversed from the Transfer when that Transfer can cover it.

`account.updated`, `transfer.created`, `transfer.failed`, `payout.paid`, and `payout.failed` are handled when they arrive. The payout screen says when the bank payout failed, and it no longer says “Held until” a time that has already passed.

Signed out, neither role creates a Connect account, a charge, or a payout.

## Finished on 8 November 2026

`backend/sql/account_identifiers.sql` was run in the SQL editor on 8 November 2026. The editor returned Success with no rows. Do not run it again.

The Worker return page is live. A signed-in PlateMaker can finish Connect and land on that HTTPS page. A signed-in PlateTaker is not sent through Connect. Signed out, neither role opens it.

On 8 November 2026 the destination named `platetaker` gained `account.updated`, `transfer.created`, `transfer.failed`, `payout.paid`, and `payout.failed`. The original 7 events stayed. The Worker version for that deploy is `623df7e0-d9f9-4275-b97b-da82a2dc9608`.

`account.updated`, `payout.paid`, and `payout.failed` for a cook’s Express account need a connected-account destination. That destination is `platetaker-connect`, on the same Worker address, created 8 November 2026. `platetaker` still listens to Your account, including the two transfer events. Its webhook secret was not rolled. The connect destination’s signing secret is `STRIPE_CONNECT_WEBHOOK_SECRET` on `plate-marketplace-api`. `STRIPE_SECRET_KEY` on that Worker is the live secret key.

Signed in, a PlateMaker’s bank payout and payout-enabled flag are saved from `platetaker-connect`. A signed-in PlateTaker’s card payment still arrives on `platetaker`. Signed out, neither role receives those events. Web, iOS, and Android use this Worker.
