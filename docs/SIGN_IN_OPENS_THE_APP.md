# Sign-in opens the app

Web, iOS, and Android use this same Expo project. Membership, the cook-path card, the buyer card, and the sign-in gate are not separate copies. A change in these files is the change for all three.

| Surface | File |
| --- | --- |
| Where sign-in lands | `app/index.tsx` and `app/(tabs)/_layout.tsx`, through `userNeedsMembership` in `backend/lib/trial-access.ts` |
| Membership, the role pills, and leaving that screen | `app/membership.tsx` |
| Your Cook Path and Where You Can Eat | `components/MembershipPromoBanner.tsx` |

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

## Website sign-in on the phone

The sign-in page on homecookedplate.com, in a phone browser, calls the same API as the iOS app and the Android app. Signed out, a PlateMaker and a PlateTaker use that one sign-in screen. Signed in, both roles use that same API for the kitchen, home, membership, and orders.

On 25 Oct 2026 that API answered every request with the plain words Internal Server Error. The sign-in card then showed the browser’s JSON error, because the body was not JSON. The Worker log for that response was `KV put() limit exceeded for the day.` The rate limit was saving a write on every request, and that store’s daily write limit was used up.

Ordinary requests now count in memory on the Worker. Sign-in, account creation, password reset, email confirmation, and reactivation still use that store. When the daily write limit is already used, those requests continue from memory instead of failing the call. An unexpected API failure returns JSON, so the sign-in card can show “Our kitchen is a bit busy right now. Please try again in a moment!”

The Worker `plate-marketplace-api` serves this for the website, iOS, and Android. A push to `main` publishes the website, including the sign-in card. The iOS and Android store builds stay on the previous copy until a new build.

## What “all three” means

The source is one. The web preview, an iOS build, and an Android build render these screens from that source. This note is about the project on this machine. A web publish and a new iOS build and a new Android build are what put the same screens on the released copies.
