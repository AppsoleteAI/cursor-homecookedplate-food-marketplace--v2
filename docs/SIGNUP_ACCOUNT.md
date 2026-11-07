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

## Signed in, after the account exists

A signed-in PlateMaker or PlateTaker cannot write `metro_area`, membership, payment, `two_factor_enabled`, or `is_paused` on their own row. Get GPS still saves `metro_area` through the Worker, and that path moves the headcount. Signed out, neither role can write the profile. The Worker can still set `metro_area`.
