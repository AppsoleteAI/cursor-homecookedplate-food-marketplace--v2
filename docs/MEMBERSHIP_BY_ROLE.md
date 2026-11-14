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

## Store charge

Web, iOS, and Android use the same prices. Signed out, neither purchase starts. Signed in, the charge follows `profiles.role`.

| Role, signed in | Monthly | Yearly | Apple product | Play product |
| --- | --- | --- | --- | --- |
| PlateMaker | $4.99 | $39.99 | `com.rork.homecookedplate.membership.monthly` and `.annual` | `com.rork.hcp.membership.monthly` and `.annual` |
| PlateTaker | $7.99 | $75.99 | `com.rork.homecookedplate.platetaker.monthly` and `.annual` | `com.rork.hcp.platetaker.monthly` and `.annual` |

The website charges those amounts through `membershipPriceCents()`. Membership on the phone asks the store for the product in that row. Play already lists the two PlateTaker products at $7.99 and $75.99. Apple still has to list the two PlateTaker products in the existing Membership group before an iPhone purchase can finish. On 11 November 2026 the Worker `plate-marketplace-api` was deployed as version `e5c616b8-2aca-430b-b822-eb8a84418b39`. It accepts those product ids. It still accepts the PlateMaker product ids, including a receipt from a binary compiled before this change. iOS 1.0.0 (11), EAS build `541353a4-7c72-4d16-b3eb-ed176fc98648`, was submitted to App Store Connect the same afternoon. Apple was still processing that upload. That binary asks the store for the PlateTaker products when the signed-in role is PlateTaker. Binaries through 1.0.0 (10), and Android version code 10, still ask the store for the PlateMaker products for a PlateTaker. `ios.buildNumber` `11` is saved on this machine and is not committed. The iPhone screenshot for the buyer prices is `store-assets/screenshot-membership-platetaker-1320.png`.

## List the PlateTaker products on iPhone

Do this on the app record. Open the existing Membership group. The create form has no level box. Apple ranks a level on the group page after the products exist, and that rank is not the price. Enter the United States price on each product. Leave the version already with App Review as it is. Family Sharing stays off: leave Turn On unclicked. Review Notes stay empty. English (U.S.) is the only localization. The description on both new products is `Premium membership for HomeCookedPlate.` The review image is `store-assets/screenshot-membership-platetaker-1320.png`. Keep `membership-review.jpg` on the two PlateMaker products.

| Reference name | Product ID | Duration | United States price | Display name |
| --- | --- | --- | --- | --- |
| PlateTaker monthly | `com.rork.homecookedplate.platetaker.monthly` | 1 month | $7.99 | PlateTaker monthly |
| PlateTaker yearly | `com.rork.homecookedplate.platetaker.annual` | 1 year | $75.99 | PlateTaker yearly |

On 11 November 2026 the PlateTaker monthly page showed Unable to Add for Review. The two missing answers are below. PlateTaker yearly uses the same two answers. Leave Membership monthly and Membership yearly as they are.

| Field on that page | Answer |
| --- | --- |
| Review Information screenshot | `store-assets/screenshot-membership-platetaker-1320.png`. It is 1320 × 2868, PNG, 72 dpi, no transparency. It shows the app is free, Monthly $7.99, and Yearly $75.99. |
| Review Notes | Empty. |
| Availability | Every country or region where the app is already sold. Membership monthly is the match. The repo has no separate country list for this subscription. |

Save. The blue line on that page says a subscription goes out with an app version. Leave the version already with App Review unchanged. Add for Review on these two products waits for the new build.

On 11 November 2026 at 3:30 PM the iOS submission page listed PlateTaker monthly as Ready to Submit and said Unable to Submit for Review until an app version is added for iOS. That version is the one already with App Review, so it is not offered on this page. Leave Submit unclicked.

At 3:39 PM the Membership group showed PlateTaker monthly, 1 month, Ready for Review, and PlateTaker yearly, 1 year, Prepare for Submission. Yearly still needs the review screenshot and the availability from the table above. After those are saved it can show Ready for Review. Leave Submit unclicked on both.

At 3:43 PM the group numbered PlateTaker monthly as level 2 and PlateTaker yearly as level 3. Those two durations are one membership, so they share one level. Membership monthly and Membership yearly already share level 1. The price stays $7.99 and $75.99. The level is not the price.

At 3:48 PM both PlateTaker rows showed Ready for Review, still on levels 2 and 3. At 3:46 PM the Draft Submission listed both subscriptions. Edit Level stays grey while they are in that draft.

At 3:56 PM the Membership group showed this table. Edit Level stays grey because the two level 1 products are Waiting for Review. Leave that review as it is. Leave PlateTaker yearly on level 3 until that review ends. Leave Submit unclicked.

| Level | Reference name | Duration | Status at 3:56 PM |
| --- | --- | --- | --- |
| 1 | Membership monthly | 1 month | Waiting for Review |
| 1 | Membership yearly | 1 year | Waiting for Review |
| 2 | PlateTaker monthly | 1 month | Ready for Review |
| 3 | PlateTaker yearly | 1 year | Ready for Review | A signed-in PlateTaker is billed from these products only after a later iOS version includes them and a build that requests them. A signed-in PlateMaker stays on the version already in review. Signed out, neither purchase starts.

A signed-in PlateMaker keeps the existing products at $4.99 and $39.99. A signed-in PlateTaker is billed $7.99 or $75.99 from the price on these two products after Apple lists them and iOS 1.0.0 (11) is installed. The Worker that accepts those ids is deployed. That iOS binary is submitted and was still processing. Android version code 10 still bills a PlateTaker $4.99 or $39.99. Signed out, neither purchase starts. Web, iOS, and Android use the same prices. This listing is done in App Store Connect. Leave Submit unclicked on the version already in review.

## Privacy Policy and Terms of Use

Web, iOS, and Android use the same Membership screen. The website publish on `main` includes this screen and `pages/legal/terms.html`. An installed app keeps the previous Membership screen until the next store build.

The Terms block on Membership has a Privacy Policy link and a Terms of Use link. Both open in the browser. Privacy Policy is `https://homecookedplate.com/privacy`. Terms of Use is `https://homecookedplate.com/terms`. The terms page states that those terms are the Terms of Use, and it states the membership prices, renewal, and cancel paths.

| | PlateMaker | PlateTaker |
| --- | --- | --- |
| Signed in | The links sit under the cook terms. Monthly is $4.99. Yearly is $39.99. Early Bird and the Remote 120 days stay on this screen. | The links sit under the buyer terms. The app stays free. Premium is $7.99 a month or $75.99 a year. |
| Signed out | The same links are on the screen. Purchase still waits for sign-in. | The same links are on the screen. Purchase still waits for sign-in. |

A paid membership renews until it is canceled. On iPhone, cancel in Settings, Apple ID, Subscriptions. On Android, cancel in Google Play subscriptions. The membership stays on that HomeCookedPlate account. It is not shared with another account.

## App review accounts

The Apple review demo account and the Google review demo account are the only Premium exceptions, and only for those app approvals. No other account can use that exception. The payment note is `docs/PAYMENT_AND_RECEIPT.md`.

## Lifetime membership after a re-download

A lifetime membership is not an App Store product. Monthly and yearly are the App Store products. Lifetime stays on the account. Deleting the app and downloading it again creates a new binding token. Sign-in on that same account saves the new token. A signed-in PlateMaker stays on the kitchen. A signed-in PlateTaker stays on home. Another account cannot take the token, because `profiles.device_id` is unique.

`backend/sql/allow_lifetime_device_rebind.sql` was run in the SQL editor on 7 November 2026. The editor returned Success with no rows. Do not run it again. The same account can store a new binding token. Another account cannot take that token.

A PlateMaker and a PlateTaker use the same sign-in check. A lifetime tier is what starts it. Signed out, the check does not run.

## App Store expiry, refund, and account deletion

Web, iOS, and Android share this source. The date columns are in `backend/sql/add_store_subscription_and_kitchen_permit.sql`. Until that SQL is run, a saved App Store or Play id with no expiry date still counts as Premium, so a current subscriber is not stripped before the dates can be stored. After a date is stored, a past expiry or a refund does not count as Premium.

The Worker `plate-marketplace-api` was deployed on 2 November 2026. Current Version ID `9fc0f7ef-d3bc-49e9-8dae-29bfb512e778`. `POST /webhook/apple` is on that Worker. The App Store Server Notifications URL is `https://plate-marketplace-api.appsolete.workers.dev/webhook/apple` for production and for sandbox. Production and Sandbox were saved on 2 November 2026 with that address. The App information page does not print a version. A URL saved from that dialog is Version 2. A browser open is a GET and shows 404. Apple sends a POST. An empty POST returns 400 and the route is live. Sign-in also refreshes a stale, missing, revoked, or past Apple or Play membership and writes the tier. The check uses an In-App Purchase key on the Worker, names `ASC_API_KEY_ID`, `ASC_API_ISSUER_ID`, and `ASC_API_PRIVATE_KEY`. The key’s name on the Generate screen is `HomeCookedPlate Server`. That name is a label only. It is the same key for a PlateMaker and a PlateTaker. When that check finds no entitlement and no end date, it stores an end date in the past so Premium does not stay on. The store subscriptions sheet is in the next iOS and Android build. Until that build, Privacy & Security shows the message and the renewal is turned off in the store. On that build, a signed-in PlateMaker and a signed-in PlateTaker reach the sheet from the last delete confirmation when renewal is still on. iPhone opens Apple’s subscriptions page. Android opens the membership already on that phone, monthly or yearly. A phone with no Play membership opens that app’s subscription list. Signed out, delete is not on the screen.

Apple cannot be cancelled by the server. Privacy & Security refuses to delete the account while App Store renewal is still on, or while the App Store key is missing and the membership still covers. The phone then opens the store subscriptions sheet. After renewal is off, delete can run again. An already expired or refunded App Store membership can be deleted. Google Play is cancelled on delete when the Play service account is present. Stripe was already cancelled on delete.

A PlateMaker whose Early Bird date is still ahead stays on Premium after an App Store expiry. A PlateTaker has no Early Bird. Another still-valid Stripe id, Play membership, or lifetime tier also keeps the account. Lifetime is not the 5% buyer fee.

| | PlateMaker, signed in | PlateTaker, signed in | Signed out |
| --- | --- | --- | --- |
| App Store expiry or refund | Premium ends unless Early Bird is still ahead, or Stripe, Play, or lifetime still covers. The kitchen follows that result. | Premium ends unless Stripe, Play, or lifetime still covers. The buyer fee returns to 10%. | No membership is shown. |
| Delete account | Delete waits until App Store renewal is off. Play renewal is cancelled when the service account is set. | The same billing check. The buyer account is what is deleted. | Delete is not available. |

## Apple retention message

Checked 5 November 2026 from the retention-messaging banner. Apple can show one message when a subscriber starts to cancel. It is configured under Monetization, Subscriptions, Retention Messaging. Text is required. An image and a retention offer are optional. This app has no retention offer. Skip the image. The image sizes Apple lists are 3840 × 2160 or 5244 × 2950.

The Retention Messaging API limits a header to 66 characters and a body to 144. The Connect form’s own counter is the one to follow if it differs. Header and body cannot name a price, a discount, or a free period. English (U.S.) is the only localization on this app.

Membership monthly and Membership yearly are the two products on the iOS 1.0 submission. Binaries through 1.0.0 (10) buy those two product ids for both roles. The source now buys the PlateTaker products for a signed-in PlateTaker. One message is attached to the two products already in review. It states only what is true for both roles: when the subscription ends, Premium ends on the HomeCookedPlate account that bought it, and the download stays free. The kitchen closing is the PlateMaker outcome. The buyer fee returning to 10% is the PlateTaker outcome. The message leaves both of those out. Attach that same message when the PlateTaker products are added.

Reference name, not shown to the subscriber:

```text
Membership stay
```

Header:

```text
Keep this HomeCookedPlate membership
```

Body:

```text
When it ends, Premium ends on the HomeCookedPlate account that bought it. The download stays free.
```

Save. Add for Review on that message page is a separate item from iOS 1.0. It does not replace the version that is Waiting for Review. Do not use a button on the version page. Web, iOS, and Android share the membership source. This message is an App Store Connect setting. No screen in the app changes.

| | PlateMaker | PlateTaker |
| --- | --- | --- |
| Signed in, subscription still renewing | Apple may show this message on the cancel path. Premium stays until the subscription ends. The kitchen still follows the paid plan, Early Bird, or the Remote 120 days. | Apple may show the same message. Premium stays until the subscription ends. The lower buyer fee stays while Premium is on. |
| Signed in, after it ends | Premium ends on that account. | Premium ends on that account. The buyer fee is 10% again. |
| Signed out | No Apple subscription on this device, so no message. Purchase still waits for sign-in. | The same. |

## Rule for later changes

Read `role` before a price, a trial, or a checkout.

- PlateMaker: $4.99 a month, $39.99 a year, and 90 days Early Bird when the metro still has a spot. Show those choices before Stripe.
- PlateTaker: free access. Optional Premium is $7.99 a month or $75.99 a year. Do not open Stripe from signup. Do not grant Early Bird.
- Do not reuse the PlateTaker "one $4.99 button" path on a PlateMaker account.
- Do not show the PlateMaker $4.99 price on a PlateTaker account.

## Four payment flows

Web, iOS, and Android use the same source. This check is local. No live card was charged. It ran 10 times in `backend/lib/__tests__/membership-payments.test.ts`.

Signed out, neither role can start a membership charge.

| Role | Interval | Charge | After the subscription is active |
| --- | --- | --- | --- |
| PlateMaker | Monthly | $4.99 | The kitchen opens. Clips can be posted. A buyer fee on this account stays 10%. |
| PlateMaker | Yearly | $39.99 | The same Premium access as monthly. |
| PlateTaker | Monthly | $7.99 | The app was already usable. Premium posts clips. The service fee is 5% when the food total is $20 or more, and 10% below that. |
| PlateTaker | Yearly | $75.99 | The same Premium access as monthly. |

On one card for a $12 cheesecake and an $18 pumpkin pie, a free PlateTaker pays $33.00. PlateTaker Premium pays $31.50. A PlateMaker Premium plan does not change that buyer fee. When the subscription is no longer active, the cook’s kitchen closes and the buyer fee returns to 10%. Signed out, Premium is not on.
