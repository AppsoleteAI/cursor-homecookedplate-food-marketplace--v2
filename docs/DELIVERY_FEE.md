# Delivery fee

Web, iOS, and Android use `DELIVERY_PLATFORM_RATE` in `backend/lib/fees.ts`. The screen copy reads the same rate from `lib/fees.ts`. The website publish includes this 10% rate. An app already installed on a phone keeps the previous rate until the next store build.

## Both outcomes

The PlateMaker sets the delivery amount and receives that amount.

| Role | What they see |
| --- | --- |
| PlateMaker | On the kitchen dashboard, a $10 delivery fee shows PlateTaker pays $11.00 and the platform keeps $1.00. Saving stores the $10 the cook receives. |
| PlateTaker | At checkout, cart, and the shop checkouts, the buyer pays the cook's amount plus 10%. A $10 delivery fee adds $1.00. The food service fee stays separate: 10% for a free PlateTaker, and 5% for a Premium PlateTaker on an order of $20 or more. |

Signed out, neither role can save or pay a delivery fee. The cook card and the buyer checkout ask for sign-in first.

## Store demo account

This repo does not store a reviewer email or password. A free PlateMaker account can be the demo for App Store review and for Google Play testers when all of these are true:

- The email is confirmed.
- Legal & Safety was confirmed on that sign-in.
- Early Bird has not been started. Play says reviewers cannot use a free trial.
- The Play full-access box stays unchecked. A free account does not include paid Premium.
- The account is not a lifetime membership, so it is not locked to one device.

Sign-in opens the kitchen dashboard for that PlateMaker and home for a PlateTaker. Membership is not the next screen. Publishing a plate inside a named metro still asks for Early Bird or a paid plan, and for a connected Stripe payout account. Those steps do not send the cook back to Membership or out of the tabs.

A build that is already on a phone still has the older sign-in landing until a new iOS build and a new Android build are installed.
