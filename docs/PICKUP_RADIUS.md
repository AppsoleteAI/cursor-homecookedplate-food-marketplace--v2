# 20-mile pickup and the Remote kitchen

Web, iOS, and Android use this same source. The website publish on `main` includes this UI on https://homecookedplate.com and https://homecookedplate.pages.dev. The 20-mile pickup check and Remote kitchen days need the Worker update plus `backend/sql/add_kitchen_pin.sql` and `backend/sql/add_five_metros.sql` in the Supabase SQL editor.

The 50-mile circle is the membership market. The 20-mile circle is pickup, centered on the cook's saved pin. The same pin rule applies in a named metro and in Remote/Other.

## PlateMaker

Signed out, Welcome says a Remote kitchen gets 120 days at no charge, then $4.99 a month or $39.99 a year, and buyers must be within 20 miles. That period is not Early Bird. Onboarding does not require a location. Continue Without a Location still creates the account and saves it as Remote/Other until Get GPS.

Signed in, outside every metro, Get GPS saves Remote/Other and the pin. Membership shows Remote · 120 days free and Start 120 days free. No card. The start date and the end date are saved. After those days the kitchen closes until monthly or yearly. Stripe payouts are still required before a plate can be ordered.

Signed in, inside a named metro, Early Bird stays 90 days when the metro still has a slot. A plate is still offered only within 20 miles of the kitchen, including to a buyer just outside the 50-mile membership circle.

A cook without a saved pin cannot publish a plate once the pin columns exist.

## PlateTaker

Signed out or signed in, the app stays free. Premium stays optional at $7.99 a month or $75.99 a year. Continue Without a Location still creates the account. It is Remote/Other until Get GPS, and the app stays free.

Signed in, a plate, clip, lane, or gift is shown only when this account's saved pin is within 20 miles of the cook. A Remote buyer in one place does not see a Remote cook in another place. Get GPS is required before an order. A buyer without a pin does not see plates.

A point outside every circle, including another country, stays Remote/Other until a later metro is added. The 20-mile rule still applies.
