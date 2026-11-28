# Discussed updates

Web, iOS, and Android use the same source. The website publish on `main` serves these app changes. iOS 1.0.0 (17) stays in review. Production builds for 1.0.0 (18) were queued on 27 November 2026 and were not submitted. Those binaries do not include the button fill or Your Location in place of the second Membership screen. iOS build `0ab87abe-4c9c-496f-990a-dd00aaf8decc`. Android build `f20e13ba-61f5-4a27-8ce0-e62be5799f68`. Production builds for 1.0.0 (19) were queued on 27 November 2026 and were not submitted. Those binaries do not include the wordmark return to limited browsing, the full-size press, or skipping Your Location after it was already passed. iOS build `569a5bd1-e614-4786-bb23-8a8310a64e40`. Android build `bf733b4a-d4d3-4cc6-ac95-1b5ca80e2b26`. Production builds for 1.0.0 (20) were queued on 27 November 2026 and were not submitted. iOS build `223892de-ea53-4b03-9fd0-3bbdb4fcc0de`. Android build `3ad1b3fd-3ab6-4897-acae-f2b818e21269`. The meal list, the signup sentence, the typed username and email, and the confirmation after the first order or plate live on the Worker `plate-marketplace-api`. That Worker was not deployed. A phone build does not publish it.

## First screen

A signed-in session stays signed in across an update.

Signed out, and this device has had a Supabase account (`hcp_has_account` or a stored profile): Sign in. That is the same for a PlateMaker and a PlateTaker.

Signed out, and this device has no Supabase account: limited browsing. A leftover Order a Plate or Start Cooking choice does not open Home on that first screen, and a leftover Apple or Google role does not open Sign in. A wiped install or a different device has no session, so it opens limited browsing until the person identifies an existing account.

The first page sets the role. Order a Plate and the plate photo store PlateTaker. Start Cooking and the cooking photo store PlateMaker. Already a member? opens Sign in. Near You is next. Your Location replaces the second Membership screen. Find My Location opens Home. Continue without a location opens Home as Remote. Home stays open for both roles. A signed-out PlateMaker does not open the cook dashboard. The honey arrow on Your Location returns to Near You. The HomeCookedPlate wordmark on Your Location returns to limited browsing for a PlateMaker and a PlateTaker. After an account exists, that wordmark returns to Username and email or Sign in, the same place as the honey arrow. On the first plate or the first order it returns to the plate or the cart. The honey arrow on Near You, and the wordmark there, both return to limited browsing.

## Create account

Email and password still send the confirmation on Account created. The username they type is the one saved. A new email does not get the Apple or Google sentence. After they confirm and sign in, a PlateMaker opens the cook dashboard and a PlateTaker opens Home when this device already continued from Your Location. When Sign in is the first screen and the account has no metro, Your Location is shown once, then the cook dashboard or Home.

PlateMaker: Account created, then Choose Membership stays available. The kitchen opens after sign-in when Your Location was already passed, or after Find My Location when Sign in is first.

PlateTaker: Account created, then See Membership stays available. Home opens after sign-in when Your Location was already passed, or after Find My Location when Sign in is first.

## Apple or Google

Apple or Google stays the password. The next screen is Username and email. The username is the one they type. The email is one they can open, and it is saved on the Supabase user. The role already chosen on Order a Plate or Start Cooking is kept. Membership is not opened again on this path.

They can browse after that screen. The confirmation mail goes to the email they typed, after the first committed action: a PlateTaker order, or a PlateMaker plate. It is not sent on the username screen, and a missing confirmation does not lock them out.

Your Location comes after that screen only when this device has not already continued from Your Location. The honey arrow and the iOS edge swipe both return to Username and email. From Username and email they return to Sign in. When Your Location was already passed, saving the username and email opens the cook dashboard for a PlateMaker and Home for a PlateTaker.

## Location

A PlateMaker and a PlateTaker who continue from Your Location on the limited-browsing path do not see that screen again after Sign in, Apple, or Google. Sign in then opens the cook dashboard for a PlateMaker and Home for a PlateTaker. That guest visit does not save a metro. Someone whose first screen is Sign in, and whose account has no metro, still sees Your Location once. Find My Location saves the pin. Continue Without a Location stays on that screen. A returning account that already has a metro opens the app. The signed-out path from limited browsing uses the same screen and then opens Home either way.

## Home and Search

Sample plates stay on Home and Search when the 20-mile circle is empty, when the metro is Remote/Other, and when no pin is saved. Real plates can still be limited to the circle. A cook’s own list does not add samples. The same list is used for a PlateTaker and for a PlateMaker who is browsing Home.

## Section cards and Oat Cookies

The painted face stays full size. A press darkens that face. It does not scale or shift, so the page color does not show above or under a chevron, a pill, or a section card. The hit box does not shrink, so the first tap opens FarmGrownBasket, MealPrepGo, CaterEventDeliver, FoodTruckPopup, and SitDownDelicious. The maroon fill and the landing photos cover the whole button. `PRESS_SCALE_ON_BUTTON` in `components/glass-surface.tsx` is false. Setting it to true puts the scale back on the button itself. Oat Cookies uses a photo that loads. A PlateMaker and a PlateTaker share these buttons. Web, iOS, and Android use the same source. The queued 1.0.0 (18) and 1.0.0 (19) binaries were started before this press. 1.0.0 (20) includes it.
