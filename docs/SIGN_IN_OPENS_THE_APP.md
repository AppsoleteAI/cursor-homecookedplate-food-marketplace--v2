# Sign-in opens the app

Web, iOS, and Android use this same Expo project. Membership, the cook-path card, the buyer card, and the sign-in gate are not separate copies. A change in these files is the change for all three.

| Surface | File |
| --- | --- |
| Where sign-in lands | `app/index.tsx` and `app/(tabs)/_layout.tsx`, through `userNeedsMembership` in `backend/lib/trial-access.ts` |
| Membership, the role pills, and leaving that screen | `app/membership.tsx` |
| Your Cook Path and Where You Can Eat | `components/MembershipPromoBanner.tsx` |

## Apple and Google sign-in

Email sign-in stays available. Sign in with Apple and Sign in with Google start that provider. `lib/provider-sign-in.ts` calls `signInWithIdToken` for the iPhone Apple sheet and `signInWithOAuth` for Google, and for Apple on the website and on Android. The libraries are `expo-apple-authentication` and `expo-auth-session`. The Apple and Google values already stored for membership stay membership records.

Signed out, a PlateMaker and a PlateTaker use those same two buttons. Order a Plate stores the PlateTaker choice. Start Cooking stores the PlateMaker choice. Apple and Google do not send a role, so the profile trigger does not guess PlateTaker. After the provider returns, an account that is already a PlateMaker opens the kitchen dashboard, and an account that is already a PlateTaker opens home. A missing profile is finished with the stored choice. If neither door was chosen, the sign-in screen asks for Order a Plate or Start Cooking and then creates the profile. A taken username gets a suffix, so the auth user is not left without a profile. Email signup for that same email says to continue with Apple or Google. Password sign-in does not say to create an account. A brand-new PlateTaker profile with no plates and no orders becomes a PlateMaker when Start Cooking was the choice. An older account, or one that already cooked or ordered, keeps its role. Email confirmation and Legal & Safety stay required. Web, iOS, and Android use the same source. This note is local until the website and a later phone build include it.

## Authenticator sign-in

The sign-in code is Supabase's own authenticator factor. Turning it on shows a secret, and the account is protected only after the 6-digit code verifies. The next sign-in, by email, Apple, or Google, stays unfinished until that code verifies. The session Supabase returns is `aal2`. An `aal1` token for an account with a verified factor is rejected by the Worker and by row security. `backend/sql/require_second_factor.sql` was run in the SQL editor on 7 November 2026. The editor returned Success with no rows. Do not run it again. `two_factor_enabled` and `is_paused` are locked against the signed-in token. The Worker still writes them with the service role.

Signed out, a PlateMaker and a PlateTaker with the authenticator on both stop at the code. Signed out, either role without the authenticator signs in as before. Signed in, either role turns the authenticator on or off from Privacy & Security. Turning it off removes the factor first. A stored session that has not finished the code is not restored. Web, iOS, and Android use the same source. This note is local until the website and a later phone build include it.

Build 8 and build 9 do not include this call. Apple will not replace a released version with a higher build number, so the phones get it in a later build. The website publish on `main` includes this screen on https://homecookedplate.com and https://homecookedplate.pages.dev. The provider return uses `homecookedplate://login` on the phone and `https://homecookedplate.com/login` on the website. Both addresses are on the Supabase Auth redirect list for project `tsrjtiunqbocmjgozeew`. Web, iOS, and Android use the same source.

On 3 November 2026, an internal check ran three times, 9 tests each time, all passing. It used the review-account columns already in the suite and did not read, write, or delete a live account. Apple’s start returned to `appleid.apple.com` and Google’s start returned to `accounts.google.com`, for the website address and for the phone address. A signed-out PlateMaker and a signed-out PlateTaker share that start. A confirmed PlateMaker is sent to the kitchen dashboard. A confirmed PlateTaker is sent home. A finished Apple or Google session was not opened, because that would sign in a live person.

On 7 November 2026, `backend/lib/__tests__/open-launch-checks.test.ts` ran five times, 25 passed, 25 total. Signed out, both roles still start Apple and Google from the same two buttons, and those starts still returned to `appleid.apple.com` and `accounts.google.com` for the website address and the phone address. A confirmed PlateMaker still goes to the kitchen dashboard. A confirmed PlateTaker still goes home. A finished session was not opened. That box stays open in `docs/POST_LAUNCH_DIAGNOSTICS.md`. Web, iOS, and Android use the same source. This note is local until a later phone build includes these buttons.

On 3 November 2026, Apple and Google were turned on for that project. Google’s audience is In production and External, so any Google account can finish that sign-in. Apple’s private-relay mail sources `homecookedplate.com` and `send.homecookedplate.com` both passed the SPF check. The Apple secret lasts six months from 3 November 2026. Generate the next one from the same `.p8` before it expires. Signed out, a PlateMaker and a PlateTaker on the public site and on builds 8 and 9 still see the old button. Signed in, neither role uses these buttons.

## Legal & Safety is stored before the app opens

Web, iOS, and Android use this same source. This note is local until the website and a later phone build include it.

Signed out, a PlateMaker and a PlateTaker complete Legal & Safety on this device, then sign in. Email sign-in sends that agreement with the password. Apple and Google sign-in save it before the account is opened. If that save fails, the sign-in screen stays here. The app does not open.

Signed in, a PlateMaker and a PlateTaker whose account already holds a complete agreement, or an older agreement that still needs the Apple app license, go straight in. A restored session with no agreement is signed out. Kitchen, home, and orders reject that session on the server. The call that stores the agreement, and sign-out, still run so the agreement can be saved.

## Confirmation link

Signed out, a PlateMaker and a PlateTaker use the same Confirm email control. A known address, an unknown address, an address that is already confirmed, and a send that did not go out all return the same sentence: if an account exists with this email, a new verification link has been sent. Each request stores a new link that lasts 24 hours from that request. An older unused link is expired and is not sent again.

Signed in, neither role uses that control.

## Authenticator code

Signed out, a PlateMaker and a PlateTaker who turned on the authenticator enter the code from that app. Supabase checks the code. The code is not saved in `audit_logs`, and it is not a `Math.random` value hashed with SHA-256. A leaked audit row has no code to walk. A wrong code does not open the app.

Signed in, either role turns that authenticator on or off from Privacy & Security.

## After a successful sign-in

Email verification and Legal & Safety stay required. After that sign-in succeeds, the next screen is the app.

- A PlateMaker opens the kitchen dashboard.
- A PlateTaker opens home.
- Membership is not that next screen. It stays available from the account and from the account-created button.

## Maroon role pills

Each pill has two outcomes. A signed-in PlateMaker and a signed-in PlateTaker do not land on the same screen.

| Pill | Signed in | Signed out |
| --- | --- | --- |
| PlateMaker | Kitchen dashboard | Sign-in |
| PlateTaker | Home | Sign-in |

The back control on Membership follows the signed-in row for the role on the screen, except while a payment is in progress.

## Honey gold

Your Cook Path and Where You Can Eat use the honey gold from the home screens: `#F6CC3E`, `#E8B016`, and `#D39A08`. The words on that gold card are white, the same white Home Kitchens uses on its gold header. Other membership text stays dark.

## Username line

On Your Account, a signed-out PlateMaker and a signed-out PlateTaker see the same line under the username. "Username available" is green. "Username taken" stays maroon. "Checking username..." and a failed lookup stay maroon. A signed-in PlateMaker and a signed-in PlateTaker do not see this form. Web, iOS, and Android use the same source. The website publish on `main` includes this copy. The store builds stay on the previous copy until a new build.

## A new account

The create-account form keeps the username, email, and role if that person leaves the form and comes back. The password and the password confirmation are empty again. That is the same form for a PlateMaker and a PlateTaker. Signed in, neither role sees this form. After the account is created, the screen that says the confirmation email was sent stays. Web, iOS, and Android use the same source.

Legal & Safety checks live on the account. The browser also kept a copy, so a deleted account's checks and date stayed on the phone after a refresh.

Signed out, a PlateMaker and a PlateTaker see those checks only after confirming them today, before the next sign-in. An older date, including 10/18/2026 from a deleted account, is removed. The boxes start unchecked and the date starts empty.

Signed in, each role sees the acknowledgment stored on that account. It counts only when it was saved after that account existed. A copy from a deleted account, including one made earlier the same day, is removed. That person checks each section again and enters today's date. The phone keeps one pending confirmation for the next sign-in. Sign-in stamps that confirmation on the account, then the pending copy is cleared. Sign-out clears it too. Each phone does this for itself, so the number of people using the app does not bring the old checks back.

A push to main publishes this on the website. The iOS and Android store builds stay on the previous copy until a new build.

## Request timed out

Signed out, email sign-in for a PlateMaker and a PlateTaker reads the saved session before the request is sent. That read waits on the Supabase auth lock, and the lock does not time out. A token refresh that never returns holds the lock, the sign-in request never starts, and the card shows "Request timed out. Check your connection and try again." after 10 seconds. Apple and Google sign-in wait on that same lock after the provider returns.

The request now starts with the token already saved for this app when that read does not finish. Email sign-in, account creation, and later kitchen and home calls use that same wait. A finished email sign-in keeps the token from the answer, so a stuck lock does not hold the card after the account has already answered. Sign-out clears that saved token for both roles.

Signed in, a PlateMaker's kitchen calls and a PlateTaker's home calls send the saved token when the lock is busy. They do not wait out the 10 seconds. An empty late read does not erase a token that is still in use.

Web, iOS, and Android use the same source. The website publish on `main` includes this fix. A new iOS build and a new Android build are still required on the phones.

## Website sign-in on the phone

The sign-in page on homecookedplate.com, in a phone browser, calls the same API as the iOS app and the Android app. Signed out, a PlateMaker and a PlateTaker use that one sign-in screen. Signed in, both roles use that same API for the kitchen, home, membership, and orders.

On 25 Oct 2026 that API answered every request with the plain words Internal Server Error. The sign-in card then showed the browser’s JSON error, because the body was not JSON. The Worker log for that response was `KV put() limit exceeded for the day.` The rate limit was saving a write on every request, and that store’s daily write limit was used up.

Ordinary requests are counted by the Worker binding `API_RATE_LIMIT`: 100 requests a minute for one IP, shared across isolates, with no KV write. `plate-marketplace-api` was deployed with that binding on 5 November 2026, version `e48ba812-f010-4bfc-8e55-61e41b99d101`.

Sign-in, account creation, password reset, email confirmation, and reactivation use `AUTH_RATE_LIMIT`: 10 requests a minute for one IP, also shared. When that binding is not on the request, those routes use KV. When the daily KV write limit is already used, those requests continue from memory and the Worker logs `KV_DAILY_WRITE_CAP` once on that isolate. That line is the paging signal. The monitor **KV daily write cap** was saved 5 November 2026. It emails `support@homecookedplate.com` when that line appears, and it checks every 1 minute. The request returns JSON. It does not return the plain words Internal Server Error. An unexpected API failure returns that same JSON, so the sign-in card can show “Our kitchen is a bit busy right now. Please try again in a moment!”

Signed out, a PlateMaker and a PlateTaker share those limits on the one sign-in screen. Signed in, both roles share the 100-a-minute limit on the kitchen, home, and orders. Web, iOS, and Android call this same Worker. The Worker deploy on 5 November 2026 is live. A push to `main` publishes the website, including the sign-in card. The iOS and Android store builds stay on the previous copy until a new build.

## Slow session restore

The first screen waits until a saved session finishes. Ten seconds is not a sign-out.

Signed out, a PlateMaker and a PlateTaker reach Welcome only after that restore finishes with no session.

Signed in, a PlateMaker whose session arrives after that wait opens the kitchen dashboard. A PlateTaker whose session arrives after that wait opens home. Neither role is shown Welcome while the restore is still running.

Web, iOS, and Android use the same source. The website publish on `main` includes this gate. The iOS and Android store builds stay on the previous gate until a new build.

## What “all three” means

The source is one. The web preview, an iOS build, and an Android build render these screens from that source. This note is about the project on this machine. A web publish and a new iOS build and a new Android build are what put the same screens on the released copies.
