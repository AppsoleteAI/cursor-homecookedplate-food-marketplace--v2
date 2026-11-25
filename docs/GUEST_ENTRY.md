# Guest entry

Web, iOS, and Android use the same source. The website publish on `main` serves this landing and guest browse path. An installed app keeps the previous entry until the next store build.

## Landing

The address is `/limited-browsing`. The app opens here when this device has never signed in and no guest role is stored. A signed-out PlateMaker and a signed-out PlateTaker share it. A device that has signed in before opens Sign in. An older account role still stored on the phone opens Sign in for both roles. A profile left behind with no session opens Sign in for both roles. A revoked saved session opens Sign in for both roles and shows "This saved sign-in has ended. Sign in again." An authenticator that has not finished opens Sign in for both roles. A live session stays signed in: a PlateMaker opens the kitchen dashboard and a PlateTaker opens home. The house mark and the HomeCookedPlate word are not a link. The two food photos have no words on them. The Start Cooking photo sits slightly above the card so the dark strip along its bottom edge is clipped. Order a Plate is unchanged. A signed-out PlateTaker and a signed-out PlateMaker see the same two photos. Order Any Time, Any Day, and Membership are on this screen. Each photo, Order a Plate, and Start Cooking open Home-Cooked Plates, Near You. They do not store a role and they do not open home. Food handling is a link on that page. Continue opens the role page. Already a member? opens Sign in. Back on that Sign in screen returns to `/limited-browsing` for a PlateTaker and for a PlateMaker. Not a member yet? on Sign in does the same for both roles when that back control is absent. That return stays on the landing, before either role enters Home. The address `/limited-browsing` stays on the landing for both roles. Back from Home-Cooked Plates, Near You returns here. Opening the site root with a guest role chosen for limited browsing, and no account on this device, still opens that role’s home. An account flag on that same phone opens Sign in for a PlateTaker and for a PlateMaker.

## Sign in

Sign in is for someone who already has an account. The two food photos have no words and are not links. The Start Cooking photo uses the same crop as the landing, so the dark strip along its bottom edge is clipped. Order a Plate is unchanged. A signed-out PlateTaker and a signed-out PlateMaker see the same two photos. Sign in with Apple, Sign in with Google, email, and password stay on this screen. The full Legal & Safety page is not part of Sign in. It opens before the first checkout for a PlateTaker and before the first plate for a PlateMaker. The words Legal & Safety are not a link. Not a member yet? sits under that line, with space above the Appsolete logo. It replaces Sign in with `/limited-browsing` for a signed-out PlateTaker and a signed-out PlateMaker. New here? Create an Account opens Your Account, the sign-up page, for a PlateTaker and for a PlateMaker. Back on Your Account returns to Sign in for both roles. Apple or Google that still needs a role opens Membership on Welcome.

The Legal & Safety box stays on Sign in. It does not open the full page and it does not block Sign in, Apple, or Google. The full page, Your Location, and the role page are in front of the first action.

## Role, then home

The role selection page is Membership, at `welcome?step=1&entry=landing`. The HomeCookedPlate logo on Home-Cooked Plates, Near You and on this role page opens `/limited-browsing` for a PlateTaker and for a PlateMaker. The HomeCookedPlate logo on Food handling opens `/limited-browsing` for both roles. The logo on the landing is not a link. Back opens Home-Cooked Plates, Near You. Order a Plate stores PlateTaker and replaces any role already stored. Start Cooking stores PlateMaker and replaces any role already stored. That choice opens home.

A PlateTaker sees Home, Search, Cart, Orders, Clips, and Profile. A PlateMaker sees Home, Search, Create Meal, Dashboard, Clips, and Profile.

## Signed out

The greeting is Hello, Guest! The location line is Pickup near you. The card uses the honey background and the maroon buttons. It is on screen only while that person is signed out. Signing in removes it and opens the real screen. Signing out brings it back.

A signed-out PlateMaker sees this card on Dashboard, Create Meal, the cook's plate-details form, and each option inside FarmGrownBasket, FoodTruckPopup, CaterEventDeliver, SitDownDelicious, and MealPrepGo. Home, Search, a plate page, Clips, Profile, and the section menus stay open. Add to Plate, a favorite, and a review ask for Sign In.

A signed-out PlateTaker sees this card on Orders, Cart, the cook's plate-details form, and each option inside those same sections. Home, Search, a plate page, Clips, Profile, and the section menus stay open. Add to Plate, a favorite, and a review ask for Sign In.

Profile offers Create an account, Sign in, and Limited browsing. The line above those choices is Create an account, sign in, or limited browsing. Limited browsing returns to that role’s home. Create an account opens Your Account for a PlateTaker and for a PlateMaker. A Few Notes Before You Order opens before that PlateTaker’s first checkout. Cottage Food Rules opens before that PlateMaker’s first plate. Sign in opens the Sign in screen. A signed-in PlateTaker returns to home. A signed-in PlateMaker opens the kitchen dashboard.

## Signed in

A PlateTaker greeting uses the account name and opens home. A PlateMaker greeting uses the account name and opens the kitchen dashboard. Signed in, Home has no back button. The device back button reloads Home and stays on Home. Profile is the account screen. Checkout, publish, and the availability switch use the account.
