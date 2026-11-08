# Stripe marketplace

HomeCookedPlate charges the PlateTaker on the platform account. A $20 plate is $22 from the buyer, $18 for the cook, and $4 kept by the app, before the card fee and any delivery fee. Both 10% fees stay with the app. The cook’s share is a Transfer after the hold, not a charge-time destination charge.

The Worker secret is `STRIPE_SECRET_KEY` on `plate-marketplace-api`. Do not put that secret in `backend/.env`.

## Connect

A signed-in PlateMaker opens Payouts and responsibility, acknowledges both fees, and taps Set up Stripe payouts. The server creates one Express account for that cook, in the US, with the `transfers` capability only. It saves `stripe_account_id` and claims it so another account cannot use it. The account link return and refresh addresses are HTTPS on the Worker:

```
https://plate-marketplace-api.appsolete.workers.dev/stripe/connect-return
```

```
https://plate-marketplace-api.appsolete.workers.dev/stripe/connect-refresh
```

Selling, a plate publish, and a buyer payment require `payouts_enabled`. An account id alone does not open the store.

A signed-out person cannot start Connect. A PlateTaker cannot start Connect.

## Hold and transfer

The plate clock starts when both people confirm pickup. A shop clock starts when the cook clears the shop order after the buyer acknowledges it. If that clear never happens, the clock starts 7 days after the cook confirms a plate handoff, or 7 days after a shop charge that is still open. The Transfer is 7 calendar days after the clock starts.

The hourly release sends `source_transaction` so the Transfer is funded by that charge. Settled means the Transfer was created. It does not mean the money is in the cook’s bank. `payout.paid` and `payout.failed` update the bank line on the payout screen.

A lost-dispute fee of $15 is withheld from a payout that is still held. If the Transfer already happened, the fee is reversed from that Transfer when the balance can cover it. Otherwise it waits on a later payout.
