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

## What “all three” means

The source is one. The web preview, an iOS build, and an Android build render these screens from that source. This note is about the project on this machine. A web publish and a new iOS build and a new Android build are what put the same screens on the released copies.
