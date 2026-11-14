# Capacity limits

Checked 5 November 2026. Web, iOS, and Android use the same source. This note is local. The Worker stays on the free plan, account email stays on the free Resend plan, and the database stays on Micro. Each of those upgrades waits until that limit is reached and app revenue covers the cost. The spend is in `POST_APP_FUNDING.md`.

## API

The free Worker allows 100,000 requests in a UTC day. One open from 10,000 people is about 120,000 requests. A day of about 30 calls each is about 300,000. A dinner rush of about 50 calls each is about 500,000. Past 100,000, Cloudflare returns error 1027. Move `plate-marketplace-api` to Workers Paid once a UTC day reaches 100,000 requests and app revenue covers the $5 a month plus usage. The midnight sentence is in this source and shows after this source is published.

Signed in, a PlateMaker sees that sentence on the kitchen when availability or the order list fails with it, and on active orders. Signed in, a PlateTaker sees it on home, search, filter, the funnel, the buyer dashboard, the orders tab, and checkout. Signed out, either role sees it on the public home, search, filter, the funnel, and sign-in. Push is not an API request to this Worker.

## Email

The free mail plan allows 100 emails a day and 3,000 in a month. Email notices default to on. A paid order sends the cook a payment notice, then the buyer an accepted notice and a ready notice. That is 3 emails, about 750 sends on a 250-order day. Marking the order picked up sends a fourth. The code counts that full path as 4 emails, about 1,000 sends. Neither fits the daily 100. Move to a paid mail plan once a UTC day reaches 100 emails, or a month reaches 3,000, and app revenue covers that plan. New accounts, password resets, welcome mail, and sign-in codes for people who turned the email code on come out of the same 100.

A Resend refusal is an unsent email. The sign-in screen does not say a code was emailed. A notice that the mail plan refused still sends push when push is on. Signed out, a confirmation that Resend refuses does not confirm the new account, and the screen says the confirmation email could not be sent. Confirmation is sent by the Worker through Resend. It spends the daily 100. It does not spend the Auth hour. A password reset uses the same recover screen for a PlateMaker and a PlateTaker, and it spends both the daily 100 and the Auth hour of 30. An unknown address still gets the success sentence. A send the mail host refuses says the reset email could not be sent. Signed in, both roles share that allowance. Reaching 80 emails in the UTC day, or 24 resets in the hour, does not stop sign-in, the kitchen, home, or checkout. Those screens stop when the UTC day reaches 100,000 Worker requests. Nothing in this source emails at 80%. The windows and the notice path are in `docs/EXPANSION.md`.

## Database

The project is on Supabase Pro, compute size Micro, 1 GB of memory, with nightly snapshots kept 7 days. A restore returns database rows to that snapshot. An order or a profile write after the snapshot is gone for the cook and for the buyer. Move to Small, about $15 a month, once dinner traffic reaches that 1 GB limit and app revenue covers the $15. Turn on point-in-time recovery once a restore to last night is the limit that has been reached and app revenue covers about $100 a month. Photos and clips sit in Storage, buckets `meal-media` and `profile-images`, which includes 100 GB. Raise that add-on once the included 100 GB is reached and app revenue covers it. A database restore does not bring a storage object back. Signed-out visitors have no account row in that snapshot.

## Store release

A full launch of both stores is not ready. The open checks in `docs/POST_LAUNCH_DIAGNOSTICS.md` are that launch.

The website and the Worker on `main` were live as of 2 November 2026. The source tree is iOS and Android 1.0.0 build 10. Build 10 is not the public binary. iOS 1.0.0 (8) was Waiting for Review. Play production 8 was In review, United States only, with 0 active devices. On 5 November 2026 at 3:22 PM the Play dashboard showed that production update published at 100%. The card does not print the version code. Build 9 is uploaded and is not that production binary. Build 8 has no home-kitchen agreement screen. The public phone app is that store binary on iOS and on Android. Email sign-in is in that binary. Apple sign-in and Google sign-in are not in that binary. A signed-in PlateMaker on build 8 saves that agreement on the website. That save is one account record. iOS, Android, and the website all use it. A signed-in PlateTaker on build 8 can order after that save. Signed out, both roles use the public site. Email sign-in is the sign-in that reaches this save and this order.
