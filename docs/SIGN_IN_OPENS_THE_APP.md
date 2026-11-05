# Sign-in opens the app

Web, iOS, and Android use this same Expo project. Membership, the cook-path card, the buyer card, and the sign-in gate are not separate copies. A change in these files is the change for all three.

| Surface | File |
| --- | --- |
| Where sign-in lands | `app/index.tsx` and `app/(tabs)/_layout.tsx`, through `userNeedsMembership` in `backend/lib/trial-access.ts` |
| Membership, the role pills, and leaving that screen | `app/membership.tsx` |
| Your Cook Path and Where You Can Eat | `components/MembershipPromoBanner.tsx` |

## Apple and Google sign-in

Email sign-in stays available. Sign in with Apple and Sign in with Google start that provider. `lib/provider-sign-in.ts` calls `signInWithIdToken` for the iPhone Apple sheet and `signInWithOAuth` for Google, and for Apple on the website and on Android. The libraries are `expo-apple-authentication` and `expo-auth-session`. The Apple and Google values already stored for membership stay membership records.

Signed out, a PlateMaker and a PlateTaker use those same two buttons. After the provider returns, an account that is already a PlateMaker opens the kitchen dashboard, and an account that is already a PlateTaker opens home. Email confirmation and Legal & Safety stay required. A provider identity with no account is asked to create an account. An account that uses a sign-in code uses email for that code.

Build 8 and build 9 do not include this call. Apple will not replace a released version with a higher build number, so the phones get it in a later build. The website publish on `main` includes this screen on https://homecookedplate.com and https://homecookedplate.pages.dev. The provider return uses `homecookedplate://login` on the phone and `https://homecookedplate.com/login` on the website. Both addresses are on the Supabase Auth redirect list for project `tsrjtiunqbocmjgozeew`. Web, iOS, and Android use the same source.

On 3 November 2026, an internal check ran three times, 9 tests each time, all passing. It used the review-account columns already in the suite and did not read, write, or delete a live account. Apple’s start returned to `appleid.apple.com` and Google’s start returned to `accounts.google.com`, for the website address and for the phone address. A signed-out PlateMaker and a signed-out PlateTaker share that start. A confirmed PlateMaker is sent to the kitchen dashboard. A confirmed PlateTaker is sent home. A finished Apple or Google session was not opened, because that would sign in a live person.

On 3 November 2026, Apple and Google were turned on for that project. Google’s audience is In production and External, so any Google account can finish that sign-in. Apple’s private-relay mail sources `homecookedplate.com` and `send.homecookedplate.com` both passed the SPF check. The Apple secret lasts six months from 3 November 2026. Generate the next one from the same `.p8` before it expires. Signed out, a PlateMaker and a PlateTaker on the public site and on builds 8 and 9 still see the old button. Signed in, neither role uses these buttons.

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

Ordinary requests now count in memory on the Worker. Sign-in, account creation, password reset, email confirmation, and reactivation still use that store. When the daily write limit is already used, those requests continue from memory instead of failing the call. An unexpected API failure returns JSON, so the sign-in card can show “Our kitchen is a bit busy right now. Please try again in a moment!”

The Worker `plate-marketplace-api` serves this for the website, iOS, and Android. A push to `main` publishes the website, including the sign-in card. The iOS and Android store builds stay on the previous copy until a new build.

## What “all three” means

The source is one. The web preview, an iOS build, and an Android build render these screens from that source. This note is about the project on this machine. A web publish and a new iOS build and a new Android build are what put the same screens on the released copies.
