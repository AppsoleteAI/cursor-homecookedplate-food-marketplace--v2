# Membership follows the role

PlateMaker and PlateTaker do not share one membership. The switch is `profiles.role`: `platemaker` or `platetaker`. Prices live in `SUBSCRIPTION_PRICES` in `backend/lib/fees.ts`. A screen, a checkout call, and a store product id have to read that role before they show a price or open payment.

Start Cooking is the PlateMaker path. Order a Plate is the PlateTaker path. Welcome, the account screen, and Membership all read that role. A cook is not shown PlateTaker prices or Use the app.

Email confirmation is required before sign-in. The link is sent when the account is created. If that send does not go out, the account screen says so and can send the link again. The link opens verify-email on the web and in the app.

## PlateMaker

A PlateMaker cooks. Membership is how Premium starts.

| Choice | Price | When it applies |
| --- | --- | --- |
| Monthly | $4.99 | `PLATEMAKER_MONTHLY` |
| Yearly | $39.99 | `PLATEMAKER_ANNUAL` |
| Early Bird | $0 for the trial, then the plan they picked | Only while their metro is active and still has a spot |

Early Bird length is `metro_geofences.trial_days`. The signup route uses 90 when that value is missing. Choosing Early Bird does not open Stripe and does not charge a card. The start is stored on `profiles.trial_started_at` when that column exists, and the end is stored on `profiles.trial_ends_at`. That end date is what the 90-day check reads. When it passes, Premium ends and the kitchen closes until they pay.

Early Bird slots are one PlateMaker per 10,000 people in that metro's July 1, 2024 Census population. The count stays between 200 and 1,000. Early Bird is not offered outside an active metro, and it is not offered once that metro's slots are full. Sign-in opens the kitchen. Membership stays on its own screen, and Early Bird or a paid plan can be chosen there. Get GPS names the nearest metro inside 50 miles so Early Bird can be offered. Signup does not start the 90 days by itself.

Trial end and the countdown in `backend/lib/trial-access.ts` apply only when `role` is `platemaker`. A paid PlateMaker stays on Premium after the trial date.

Signup copy for a lost dispute is `PLATEMAKER_LOST_DISPUTE_SIGNUP`.

## PlateTaker

A PlateTaker orders. The app is free. Premium is optional and has no trial.

| Choice | Price | When it applies |
| --- | --- | --- |
| Use the app | $0 | Default. Signup does not open payment. |
| Monthly Premium | $7.99 | `PLATETAKER_MONTHLY` |
| Yearly Premium | $75.99 | `PLATETAKER_ANNUAL` |

Premium cuts the service fee on the receipt from 10% to 5% on orders of $20 or more. There is no 90-day Early Bird for this role.

Signup in `backend/trpc/routes/auth/signup/route.ts` returns `SUCCESS` for a PlateTaker, including outside a metro and when a metro cap is full. `REDIRECT_TO_PAYMENT` is not a PlateTaker result.

Signup copy for a lost dispute is `PLATETAKER_LOST_DISPUTE_SIGNUP`.

## After Legal & Safety

Create account does not open Stripe. Both roles see Account created, then Membership for the role they chose. A cook who is not signed in yet still sees PlateMaker membership. A buyer still sees free access and optional Premium.

A PlateMaker can open Membership and choose Early Bird or a paid plan. Sign-in itself opens the kitchen. The account-created button is Choose membership.

A PlateTaker is told the app is free. Premium is optional at $7.99 a month or $75.99 a year, and it cuts the service fee from 10% to 5% on orders of $20 or more. The button is See membership. Membership still has Use the app.

## Free entry on Membership

Web, iOS, and Android use this same screen. The website publish includes this screen. An installed app keeps the previous membership screen until the next store build.

| | PlateMaker | PlateTaker |
| --- | --- | --- |
| Gold card words | Your Cook Path, white on honey gold | Where You Can Eat, white on honey gold |
| Under the maroon button | No green sentence. The button is PlateMaker. | No green sentence. The button is PlateTaker. |
| Green words above the prices | Hidden until Get GPS finishes and the location is inside a metro or outside every metro. | Hidden until that same check finishes. Then the green line says the app is free and Premium is optional. |
| After Get GPS names a city, signed in | Early Bird at no charge, or a paid plan before the kitchen opens. Outside every metro, the screen offers 120 days at no charge, then $4.99 a month or $39.99 a year. | The same alert says the app is free and to use the app. Premium stays optional. A plate is shown only within 20 miles of the cook. |
| After Get GPS names a city, signed out | Click the maroon PlateMaker button to sign in. Early Bird is 90 days at no charge. Outside every metro, the alert says the account is Remote and the 120 days start after sign-in. | Click the maroon PlateTaker button to sign in, then use the app. The app is free. |
| Free control on the screen | Early Bird inside a metro. Outside every metro, Start 120 days free. | Use the app, above the $7.99 and $75.99 prices, when signed in. |

Get GPS still reads the device and saves the metro. The free-entry words are the only addition on the buyer alerts.

Device back on the Legal step returns to Your Account, the previous step. It does not jump to Welcome.

## Public membership page

`https://homecookedplate.com/information` is the Marketing URL on iOS version 1.0. Apple’s subscription screens have a display name and a description. Membership monthly is `Membership monthly` and `Premium membership for HomeCookedPlate.` Membership yearly uses that same description and the display name `Membership yearly`. The page is `pages/legal/membership.html`, served at `/information`. After Membership it shows the tablet row. After Who it is for it shows the headline and the PlateTaker card. After Price it shows sign-in for both roles, the herb chicken plate, and the PlateMaker card. The earlier eight pictures remain under In the app. It shows a PlateMaker card at $4.99 a month and $39.99 a year and a PlateTaker card at $7.99 a month and $75.99 a year. The PlateTaker card says the app is free. PlateTaker Premium cuts the service fee from 10% to 5% on orders of $20 or more. Early Bird stays in the app and is not on that page. Signed in and signed out see the same public page. The app membership screen stays at `/membership` for a PlateMaker and a PlateTaker, signed in and signed out. The website publish includes this page. An app already on a phone keeps the previous membership screen until the next store build. Web, iOS, and Android still share the app.

## Rule for later changes

Read `role` before a price, a trial, or a checkout.

- PlateMaker: $4.99 a month, $39.99 a year, and 90 days Early Bird when the metro still has a spot. Show those choices before Stripe.
- PlateTaker: free access. Optional Premium is $7.99 a month or $75.99 a year. Do not open Stripe from signup. Do not grant Early Bird.
- Do not reuse the PlateTaker "one $4.99 button" path on a PlateMaker account.
- Do not show the PlateMaker $4.99 price on a PlateTaker account.
