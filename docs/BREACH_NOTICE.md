# HomeCookedPlate breach note

Keep this next to the Supabase backup settings. It is the procedure for telling people if their account data is exposed. It is not a substitute for a lawyer. Confirm the current statute before the first notice goes out.

A breach here means personal data held for HomeCookedPlate was acquired by someone who should not have it, or was exposed in a way that creates a real risk of that. Account email, phone, profile, device-binding token, location, order history, messages, and photos count. Card numbers are held by Stripe, not in the app database. If Stripe or Supabase tells you they had an incident that includes this project, treat that as this procedure too.

## Who gets called

Call in this order, the same day you know the exposure is real.

1. The person who operates HomeCookedPlate and holds the Supabase project, the Stripe account, and the Apple Developer account. That person owns the decision to notify.
2. A privacy lawyer, before any user email is sent. State clocks are not the same, and some notices also go to a state attorney general.
3. Supabase support, if the database, auth store, or backups are the source. Do not restore a backup over the live database until you know the backup is clean.
4. Stripe support, if payment or Connect account data is in the exposed set.
5. Apple, through the Developer account, if App Store or device data Apple requires you to report is involved. The Developer Program License Agreement, section 3.3.3(C), expects users to be told.
6. `support@homecookedplate.com` is the public inbox. Someone must read it the same day, because users will reply there.

Do not post about the incident on social accounts before the affected users have the email.

## How to email affected users

Send one message to each affected account, to the email stored on that profile. Send it from `HomeCookedPlate <support@homecookedplate.com>` so the person can reply. Do not use the no-reply sender.

Subject: `Security notice for your HomeCookedPlate account`

Say, in plain language:

- What happened, and the date you discovered it.
- Which kinds of information were involved. Name the categories. Do not paste passwords, tokens, order contents, or other people’s data into the email.
- What you have done, such as closing the exposure, resetting sessions, or rotating keys.
- What you want them to do: sign in again, change the password, and ignore messages that ask for a password or a payment outside the app.
- That questions go to `support@homecookedplate.com`.

Send to the people you already know are affected. If the list grows, send a follow-up. Do not wait for a perfect list if a deadline that applies to this group is close.

## Deadlines are not one number

US states do not share one notice deadline. Some start on the day you discover the problem. Some start on the day you decide it is a breach. Some say “without unreasonable delay.” Some count a set number of days. Some require a separate notice to the state attorney general when the number of people passes a threshold. A user in one state can be on a shorter clock than a user in another.

Before you send, ask counsel which states are in the affected set and which deadline is the shortest. Meet that shortest deadline for the whole group. This page only records that the clocks differ. It does not list them, because the statutes change.
