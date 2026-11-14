# Signup account

Web, iOS, and Android use the same source. The website publish on `main` includes Create Account. On 6 November 2026 the SQL editor ran `backend/sql/protect_membership_columns.sql` and returned Success with no rows. That saved the lock. Do not run it again. This push does not redeploy the Worker.

Create Account is `app/(auth)/onboarding.tsx`. The older screen `app/(auth)/signup.tsx` uses the same form. Signed out is the only way either screen is used. A duplicate email does not open a session and does not show Account created.

## Duplicate email

The password is not checked. A confirmed account and an unconfirmed account get the same message: "An account with this email already exists. Please use login instead." No profile is returned. The screen stays on the form and shows that message.

| | PlateMaker, signed out | PlateTaker, signed out | Signed in |
| --- | --- | --- | --- |
| Existing email, any password | The form shows the message above. Account created does not open. No session is stored. | The same message. Account created does not open. No session is stored. | This screen is not shown. The public signup call still returns that same message and does not open a session. |

## New account

Coordinates are read on web, iOS, and Android before the account is created. A denied or unavailable reading continues as Remote/Other and does not take a slot.

The metro is decided before the auth user is created. A paused metro stops with "Signups in {city} are currently paused for maintenance." No auth user is created and no slot is taken.

An active metro holds one slot, then the profile is written. If that write fails, the slot is returned and the auth user is deleted. A full metro still creates the account and does not hold a slot. Early Bird stays closed in that case.

| | PlateMaker | PlateTaker |
| --- | --- | --- |
| Inside an active metro | `metro_area` is that city. One `platemaker_count` slot is held. Account created says to choose Early Bird or a membership in that city. Early Bird does not start until they choose it. | `metro_area` is that city. One `platetaker_count` slot is held. Account created says the app is free and Premium is optional. There is no Early Bird. |
| Outside every metro, or location denied | Remote/Other. No slot. Account created says the account is Remote, with 120 days at no charge, then a monthly or yearly plan. | Remote/Other. No slot. Account created says the app is free and Premium is optional. |
| Paused metro | The form shows the paused message. No account. | The same paused message. No account. |
| Profile write fails after a slot was held | The auth user is deleted and the PlateMaker slot is returned. Account created does not open. | The auth user is deleted and the PlateTaker slot is returned. Account created does not open. |

## Busy kitchen on Create Account

Checked 10 November 2026 against the live API. A signup with no coordinates returns Remote/Other and creates the account. A signup at New York coordinates returned “Our kitchen is a bit busy right now. Please try again in a moment!” The Worker stack was `column "updated_at" of relation "metro_area_counts" does not exist`. `increment_metro_count` writes that column. The auth user from that failed call was deleted. No metro slot stayed held.

The phone reads location before Create Account. A PlateMaker and a PlateTaker inside a metro both used this write. Location denied, or a point outside every metro, stays Remote/Other and the account is created. Signed in, Get GPS uses the same function when it moves a cook or a buyer into a named metro.

`backend/sql/add_metro_counts_updated_at.sql` was run in the SQL editor on 10 November 2026. The editor returned Success with no rows. Do not run it again. A later PlateTaker signup at New York coordinates returned Success for New York-Newark-Jersey City. The PlateMaker branch of the same function writes `updated_at` on the same table. Web, iOS, and Android use this Worker. No Worker deploy was required.

Both diagnostic PlateTaker addresses are gone. Sign-in on 10 November 2026 returned no account for `play-signup-check-20261110@example.com` and for `play-signup-check-20261110c@example.com`. Deleting an account does not lower `platetaker_count`. The New York signup had held one PlateTaker slot in New York-Newark-Jersey City. That count was lowered by one in the SQL editor on 10 November 2026. The editor returned Success with no rows, which is what an update shows when it does not return a grid. Do not run that update again. A second run would lower the PlateTaker count by another one.

A PlateMaker slot was not held by that first check. The column script stays as run. Do not run `add_metro_counts_updated_at.sql` again. Do not run the earlier PlateTaker-only count update again.

The same Create Account call was retested on the live API on 10 November 2026 after the column existed. New York coordinates for a PlateTaker returned Success. New York coordinates for a PlateMaker returned CHOOSE_MEMBERSHIP. Neither response was the busy-kitchen sentence. Each call held one slot in New York-Newark-Jersey City. Both accounts were deleted the same day. Sign-in returned no account for `play-retest-taker-20261110d@example.com` and for `play-retest-maker-20261110d@example.com`. The New York PlateTaker count and PlateMaker count were each lowered by one in the SQL editor. The editor returned Success with no rows, which is what an update shows when it does not return a grid. Do not run that paired update again. A second run would lower both counts by another one.

The signup source on `main` still calls `increment_metro_count`. That function was already writing `updated_at`. The failure came back because the live table did not have the column. The last Expo pair is iOS 1.0.0 (10) build `a7bdfb38-d84b-41dc-a2d5-9063e1830fc6` and Android 1.0.0 (10) build `98635aca-5ec6-4f9f-b0c0-28ca7fc4344e`, from commits `582324c` and `1e7a9a6` on 10 November 2026. `backend/sql/add_metro_counts_updated_at.sql` is not in either commit. Those binaries do not add the column. A PlateMaker and a PlateTaker on that pair already call this Worker, so Create Account inside a metro uses the column that is now on the live table. A later SQL change that writes a column the live table does not have would show the same sentence again, because an internal signup failure is still replaced with that sentence before it reaches the form.

## Signed in, after the account exists

A signed-in PlateMaker or PlateTaker cannot write `metro_area`, membership, payment, `two_factor_enabled`, or `is_paused` on their own row. Get GPS still saves `metro_area` through the Worker, and that path moves the headcount. Signed out, neither role can write the profile. The Worker can still set `metro_area`.
