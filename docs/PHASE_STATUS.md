# Phase status

Our goal is to review, resolve to completion, and only find issues that weren't known so they can be resolved to completion.

A known statement is work to finish. A new statement is only for a problem the open list does not already cover. The same rule on the next screen is still that known problem. It is finished with the statement that covers it, and it is not parked as a later phase.

A **completed task** is code that is in this repo and covered by the checks named under that phase.

A **statement** is a review finding. It is not done. No phase still has a statement.

Phases 1–26 are completed tasks in the local repo. They are not on the live Worker or the live site. `lib/trpc.ts` calls `https://homecookedplate.com`. The published website and builds 8 and 9 still call `https://homecookedplate.pages.dev` until the next website publish and a later phone build. A full launch of both stores is not ready. Those completed tasks do not close the open checks in `docs/POST_LAUNCH_DIAGNOSTICS.md`. Those open checks are the launch.

## Completed tasks

### Phase 1 — entry

1. A saved profile without a session is cleared. Signup sets the user only after a session is stored.
2. An unpaid Remote PlateMaker stays on Membership until Get GPS, then starts 120 days or a paid plan. The kitchen does not stay open without a charge.
3. Early Bird shows a checking state and starts only when the offer has days left.
4. Food handling returns to Create Account, and the signup draft is kept until success.
5. Membership back is hidden while the account is gated.
6. A GPS failure does not show the raw ID-card string and does not mark the cook outside.
7. Available For Orders stays off until the availability check succeeds.

### Phase 2 — cook orders and publish

1. Order lists read the buyer id and the plate total from either column name.
2. The cook marks Ready for pickup. Phase 9 requires both people to confirm pickup before the order is completed.
3. The earnings card uses the dashboard take-home figure.
4. The payout card says Stripe On or Set up.
5. An ingredient photo stays on that screen only.
6. Publishing requires food safety, a named metro the cook may enter, and a Stripe account. Remote may publish without a plan.
7. A plate stays unpublished until cuisine, ingredients, and a date are saved.

### Phase 3 — menu, pay, offers, clips, lanes, settings

1. The menu filters by the cook's metro when a metro is requested. A direct plate link still opens.
2. The area switch restores the last saved area.
3. Web pay opens a Stripe Checkout Session. Native pay still uses the payment sheet.
4. Promotions are saved and the charged base uses `chargedPlateBase` in `backend/lib/fees.ts`. While a sale is active, that price replaces the list price for a PlateMaker and a main admin. After the sale ends, the list price is charged again. `backend/sql/sale_price_overrides_list.sql` was run in the SQL editor on 11 November 2026. The editor returned Success with no rows. Do not run it again. The check returned one row: `sale_math` true, `status_keeps_sale` true, and trigger `calculate_order_price_trigger` before insert or update on `orders`. The Worker `plate-marketplace-api` was deployed 11 November 2026, version `49fa2149-ec91-4b7f-a12f-6732bfdb4af3`. The website publish on `main` includes the menu and shop screens. An installed phone keeps the previous bundle until the next store build.
5. A clip is stored only after the shared timeline accepts it.
6. Lane listings are written to `lane_listings`. Checked 21 Oct 2026 on project `tsrjtiunqbocmjgozeew`: `lane_listings`, `food_review_clips`, and `orders.pickup_timezone` are on the live database.
7. Sound and location settings are saved. Nothing else reads them, so they do not turn GPS or sound on or off.

### Phase 4 — pay, closeout, shop orders

1. Cancelling the card, or leaving web pay, closes the unpaid pending order. Accept requires a paid order.
2. A successful card sets paid and holds the payout. It does not accept the order.
3. Confirming payment writes that paid row. The thank-you screen keeps the cart if that write fails.
4. The order page shows the pickup time. Plate and combined thank-you leave goes to the buyer dashboard.
5. Returning to the app refreshes orders.
6. The payout clock starts when the order is completed.
7. A failed refund leaves a paid denial open.
8. A cook refund that updates the card but not the row is reported as still open.
9. Farm, truck, catering, meal-prep, and sit-down order screens use Accept, Refund, and Order completed when the saved line has a seller and a status.

### Phase 5 — account and checkout

Completed in this repo.

1. Delivery requires an address and a cook fee above zero. The order stores the address, and the order page shows it. The cook fee card was already on the dashboard.
2. Pay requires a pickup time that has not passed, on the checkout screen and in `orders.create`. Reorder does not copy a past time.
3. Already completed in phase 4. Plate checkout and combined checkout leave the thank-you screen for the buyer dashboard.
4. Two-factor sign-in emails a 6-digit code. Login does not return a session until that code matches. The code is stored as a hash and expires in 10 minutes. If the email cannot be sent, sign-in stops.
5. Changing the password checks the current password first.
6. Pause signs the phone out. A paused account is rejected on later API calls.
7. The data export includes that account's orders, messages, and payment rows.

Not exercised: a real inbox, a paused account on a second device, a card charge, or a signed-in pass through checkout.

### Phase 6 — account, menu, and notices

Completed in this repo. Not exercised: a card refund, a real inbox, or a signed-in pass through delete, unpublish, or the email switch.

1. Delete account refunds and closes open paid plate and shop orders before it removes the account. A shared charge that includes someone else's order stops the delete. The phone keeps the session if the server delete fails.
2. Edit Profile changes the auth sign-in email and the profile email together.
3. A missing Available For Orders value stays off, and a new order requires the cook to be on.
4. The cook dashboard can unpublish one plate. `orders.create` rejects a plate that is unpublished or unavailable.
5. Favorites are stored per account. Logout clears the cart.
6. Message send, list, and conversations read the buyer id from either column name.
7. Accept, ready, pickup, cancel, a new message, a payment, and a review notify the other person by email and push when that person's switches allow it. Turning email notices on sends a confirmation email.
8. Leaving a plate's reviews returns to that plate.
9. A blank filter max does not become $100.
10. Create Meal does not upgrade a PlateTaker until food safety is acknowledged and a membership is on the account.

### Phase 7 — location

Completed in this repo. The automatic stay is more than 30 minutes. Not exercised: a signed-in 30-minute GPS stay, or a signed-in pass on a phone.

1. Get GPS is on the PlateMaker profile and saves that metro when the cook taps it.
2. Get GPS is on the cook dashboard and the incoming order list.
3. While the app is open, a different metro is saved after the phone has been inside it for more than 30 minutes.
4. A stay of 30 minutes or less does not change the saved metro, so plates and the Early Bird city stay put. That path does not move the headcount.
5. Home, search, and filter already read the saved metro, so a PlateTaker follows the new metro after those 30 minutes.
6. A drive-through of 30 minutes or less keeps the previous metro's menu.
7. After those 30 minutes, the saved metro changes, and a plate from the previous metro is no longer shown as local.

### Phase 8 — metro counts, fees, and buyer orders

Completed in this repo. Not exercised: a signed-in 30 minutes outside a circle, a Premium PlateTaker card charge, or a buyer cancel of a paid order. `backend/sql/add_pickup_timezone.sql` was applied 21 Oct 2026. The SQL editor returned Success with no rows, and the follow-up select returned one row, `pickup_timezone`. A new PlateMaker order and a new PlateTaker order can save the zone name with the pickup instant.

1. A committed metro change moves the headcount off the old metro and onto the new one. A visit of 30 minutes or less does not, and it does not start Early Bird.
2. The Early Bird end date stays with the metro where it was claimed. It does not start again in the new metro.
3. More than 30 minutes outside every circle saves Remote/Other. A shorter drive does not. A paused metro does not.
4. PlateTaker Premium cuts the buyer service fee from 10% to 5% on an order base of $20 or more. The cook's 10% stays. Checkout shows that percent.
5. Your Dashboard lists each order and reloads when it opens.
6. A buyer can cancel a pending order. A paid pending order is refunded first. If the refund fails, the order stays open.
7. The menu query filters by the cook's metro in the database. Pickup times keep the buyer's time zone when that column is present. A cook with an open order is not sent to Membership only because the 30-minute metro change left the Early Bird city.

### Phase 9 — order chat, pickup, and portions

Completed in this repo. Not on the live Worker. Not exercised on two phones, with two card payments, or with a second buyer racing the last portion.

1. The open order screen redraws when messages are loaded or sent.
2. One pickup confirmation leaves the order ready. The second confirmation completes it and starts the payout clock.
3. Checkout and `orders.create` accept a pickup time only when it falls on a day and hour saved on the plate. A plate with no saved days still only needs a future time.
4. A plate stores a portion count. Open orders hold those portions. A second buyer cannot pay past the count. A completed or cancelled order frees its portions. A plate with no saved count has one portion.
5. `orders.create` rejects a cook buying their own plate. A cook cannot review their own plate.
6. An ended trial does not send the cook to Membership while a paid order is still pending, accepted, preparing, or ready.
7. An unpublished plate does not open for anyone except the cook. Checkout still rejects it.
8. The PlateTaker can block or report the cook from the order. A block stops a later order from that account.

### Phase 10 — stars, sign-in code, pay, and notes

Completed in this repo. Not on the live Worker. Not exercised with a real sign-in email, a card payment on a `platetaker_id` row, or a lifetime account on a second phone.

1. Plate cards and the plate page show the rating and review count stored on the plate. A new review updates those numbers. The phone no longer loads a shared review list for the stars.
2. Five wrong sign-in codes close that code. A later try asks for a new code.
3. Paying an order reads the buyer from `buyer_id` or `platetaker_id`, and the plate total from `total_price` or cents.
4. A chat message and a checkout note go through the same text check as a username or a bio. A blocked note is not saved.
5. A lifetime account on a different device is allowed. That device token is saved on the account. The check does not send the person to the mismatch screen.

### Phase 11 — reorder, metro, and refund notices

Completed in this repo. Not on the live Worker. Not exercised with a past order on a phone, a plate from another metro, or a real deny or refund email.

1. Order history and the buyer dashboard keep a pickup time on reorder only when that time is still ahead.
2. A signed-in buyer's saved metro is checked on the plate link, on checkout, and in `orders.create`. A plate outside that metro is not opened and is not paid. The same check applies to a home plate on a combined checkout.
3. Denying a plate order, refunding a plate order, and refunding a shop order email and push the buyer when that person's switches allow it. A notice failure does not undo the deny or the refund.

### Phase 12 — paused cooks, the cart, and a shared charge

Completed in this repo. Not on the live Worker. Not exercised with a paused cook, a cook who turns orders off, or two orders on one card.

1. A paused cook's plates are left off the public menu and the plate link. `orders.create` and a combined checkout reject that cook.
2. The cart does not take a plate when Available For Orders is off. Checkout stops before payment. Reorder checks the plate again before adding it.
3. A pending order that shares a card charge is cancelled for its own share of that charge. The other open order on the charge stays paid.

### Phase 13 — membership, fees, metro, and notices

Completed in this repo. Not on the live Worker. Not exercised with a closed app, a premium card, a shared refund, or an admin rename.

1. A cook with an Early Bird claim city is sent to Membership when that city and the current metro differ and the server says membership is required. An opened kitchen still skips that gate only when there is no claim city.
2. A gap with no location reading starts the 30 minutes over. The first reading after that gap does not save the metro.
3. The cart, the plate page, and the farm, truck, catering, meal-prep, and sit-down checkouts use the buyer's service fee. The cook's 10% stays.
4. One card uses the combined food total for the Premium $20 rule. The screen uses that same total.
5. A failed menu join still filters plates in memory. The page limit runs after that filter.
6. A failed metro save removes the count that was added to the new metro.
7. Delete account moves the person from the saved metro to Remote/Other before the account is removed.
8. A buyer cancel and a cook refund both return the cook's share from `saleRefundCents`. Checkout already says those fees are not returned.
9. Lane listings and clips use the saved metro, the same way Home does.
10. The bell reads the notifications table for the signed-in person.
11. A cook can post a clip on the same paid plan the kitchen uses, including lifetime and Early Bird. A PlateTaker needs premium.
12. Data export includes that person's shop orders and leaves Stripe ids out.
13. Admin monitor still does not change price or published. The cook is told when a plate or a screen name changes.

### Phase 14 — portions, pickup, and blocks

Completed in this repo. Not on the live Worker. Not exercised with two buyers paying for the last portion, or with a pickup confirmation on two phones.

1. The later plate details screen saves a new portion count on the plate.
2. An unpaid order does not hold portions. A payment that is past the count is cancelled and that charge is refunded.
3. A new plate stores the cook's time zone with the pickup days. Checkout checks that window in the cook's time zone.
4. A block or a report tells the cook. The buyer can remove the block from the order.
5. Opening the order again shows who already confirmed pickup, and that person does not see the pickup button. The server still waits for the other person.

### Phase 15 — review text and sign-in codes

Completed in this repo. Not on the live Worker. Not exercised with a real inbox or five wrong codes on a phone.

1. A review comment is saved only after the same text check used on a chat message and a checkout note.
2. Signing in again keeps the open code. Five wrong tries still close that code. A new code is emailed after it expires or after those five tries.

### Phase 16 — plate links, metro pay, and shop notices

Completed in this repo. Not on the live Worker. Not exercised with a signed-out phone, a buyer with no saved metro, or a combined refund.

1. A signed-out plate link does not open.
2. A buyer with no saved metro cannot pay for a plate. A saved metro still has to match the cook.
3. Refunding one area of a combined checkout emails and pushes the buyer.
4. Accepting a farm, truck, catering, meal-prep, or sit-down order emails and pushes the buyer.

### Phase 17 — menu and cart when orders are off

Completed in this repo. Not on the live Worker. Not exercised with a cook who turns Available For Orders off while a buyer is on the menu.

1. The public menu leaves out a plate after the cook turns Available For Orders off. The cook's own plate list still shows it.
2. A plate already in the cart is removed after the cook pauses or turns Available For Orders off.

### Phase 18 — buyer fee, metro scope, shop refund, and notices

Completed in this repo. Not on the live Worker. Not exercised with a Premium PlateTaker basket, a signed-out menu, or a pending shop refund.

1. The farm, truck, catering, meal-prep, and sit-down baskets, and the catering package page, use the buyer's fee. A Premium PlateTaker pays 5% on an order of $20 or more.
2. The lane intros say the service fee is 10%, and that a Premium PlateTaker pays 5% on an order of $20 or more.
3. A buyer with no saved metro does not see lane listings, clips, or plates from other cities. A signed-out menu does not list those plates. A signed-in buyer with no saved metro cannot open one.
4. A pending shop refund returns the cook's share, the same amount as a plate cancel.
5. An admin rename, a block, and a report still reach the cook when order updates are off.

### Phase 19 — old pickup clocks and a lost portion

Completed in this repo. Not on the live Worker. Not exercised with an old plate or a failed card refund.

1. A plate saved before a cook time zone was stored is not checked in UTC. Checkout waits until the cook saves that clock. Saving plate details stores the cook's time zone.
2. A payment that loses the last portion stays open until that charge is refunded. The order is cancelled after the refund.

### Phase 20 — reports, reactivation, sign-in codes, and which order is reviewed

Completed in this repo. Not on the live Worker. Not exercised with a reported comment, a paused account, five wrong codes, or two completed orders.

1. A review report tells each admin, including the plate name. The review page and the reviews dashboard let an admin remove the words.
2. Reactivate asks for the password. Email alone does not turn a paused account back on.
3. After five wrong sign-in codes, the open sign-in screen stops requiring that code. The next sign-in emails a new one.
4. A review with more than one completed order waits until the buyer chooses one, including an older order.

### Phase 21 — shop refund and shop completion

Completed in this repo. Not on the live Worker. Not exercised with a combined refund or a completed shop order.

1. Refunding a farm, truck, catering, meal-prep, or sit-down area of a combined checkout cancels that shop order. A food cart and a ghost kitchen on that same charge are cancelled the same way. The other areas on the charge stay paid.
2. Marking a farm, truck, catering, meal-prep, or sit-down order complete emails and pushes the buyer. Accept and refund on those same screens already did.

### Phase 22 — plate links and saved favorites when orders are off

Completed in this repo. Not on the live Worker. Not exercised with a cook turning Available For Orders off while a buyer has that plate open or saved.

1. A plate link does not open after the cook turns Available For Orders off. The cook can still open their own plate. Home, search, and the order-again shelf only keep plates that are still taking orders.
2. A saved favorite leaves the buyer dashboard after the cook turns Available For Orders off. It returns when that cook is taking orders again.

### Phase 23 — combined shop orders on the lane screens

Completed in this repo. Not on the live Worker. Not exercised with a combined checkout on a phone.

1. A farm, truck, catering, meal-prep, or sit-down order paid inside a combined checkout appears on that area's order screen. A food cart appears with the truck orders. A ghost kitchen appears with the sit-down orders. The screen says the order was paid on a combined checkout.

### Phase 24 — combined checkout handoff

Completed in this repo. Not on the live Worker. Not exercised with a paid combined checkout where the buyer picks a handoff.

1. A farm, truck, catering, meal-prep, or sit-down order paid inside a combined checkout keeps the pickup, drop-off, or table the buyer chose. A food cart uses the truck pickup time. A ghost kitchen is takeout and has no table. The order screen shows that choice. An older combined order that was saved before a choice existed still says it was paid on a combined checkout.

### Phase 25 — paid baskets on the browser return

Completed in this repo. Not on the live site. Not exercised with a card payment in the browser.

1. After a combined checkout is paid in the browser, the farm, truck, food-cart, catering, meal-prep, sit-down, and ghost-kitchen baskets are emptied. The same checkout on the phone already emptied them. Each lane’s own browser checkout empties that basket too. The buyer cannot pay the same lane order again from the basket that was just charged.

### Phase 26 — plate rules on a combined charge, and the cook payment notice

Completed in this repo. Not on the live Worker. Not exercised with a card payment.

1. A home plate paid inside a combined checkout is its own order. It keeps the pickup time, the cook's time zone, the note, the allergies, the cooking temperature, and the delivery address. The offer price is the charged base. A plate that is unpublished, outside the saved metro, or past its portions is rejected. A lost portion refunds that home section, cancels those plate orders, tells the buyer, and leaves that plate in the cart. The cook's 10% stays.
2. The same plate checkout stops for pickup, portions, and a sample plate run before the combined charge.
3. Paying a farm, truck, food-cart, catering, meal-prep, sit-down, or ghost-kitchen order tells the cook, on that lane's own checkout and on a combined checkout. A notice failure does not undo the payment.

## Statements — not started

None.
