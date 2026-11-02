# Password reset

Forgot password is the same screen for a PlateMaker and a PlateTaker. Web, iOS, and Android use this source. The website publish on `main` includes this screen on https://homecookedplate.com and https://homecookedplate.pages.dev. The iOS and Android store builds stay on the previous copy until a new build.

## Signed out

Both roles open Forgot Password from sign-in, enter an email, and get a reset link if that address has an account.

- On the website, the link returns to `https://homecookedplate.com/reset-password`. The page reads the session Supabase attaches to that link, then asks for a new password.
- In the iOS app and the Android app, the link opens the app. The tokens after `#` stay with that screen. The same new-password form is shown.

A link that is missing or expired stays on this screen and offers a new email. It does not leave for sign-in on its own.

After the new password is saved, the app opens the kitchen for a PlateMaker and home for a PlateTaker.

## Signed in

A reset link still opens the new-password screen for whichever role is signed in. It does not skip ahead to the kitchen or to home. After the new password is saved, a PlateMaker opens the kitchen and a PlateTaker opens home.
