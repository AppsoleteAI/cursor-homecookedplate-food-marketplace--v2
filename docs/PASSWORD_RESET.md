# Password reset

Forgot password is the same screen for a PlateMaker and a PlateTaker. Web, iOS, and Android use this source. The website publish on `main` includes this screen on https://homecookedplate.com and https://homecookedplate.pages.dev. The iOS and Android store builds stay on the previous copy until a new build.

## Signed out

Both roles open Forgot Password from sign-in, enter an email, and get a reset link if that address has an account.

- On the website, the link returns to `https://homecookedplate.com/reset-password`. The page applies that link, then asks for a new password.
- In the iOS app and the Android app, the link opens the app. The tokens after `#` stay with that screen. The same new-password form is shown after those tokens are applied.

A link that is missing or expired stays on this screen and offers a new email. It does not leave for sign-in on its own. It does not save a password.

The new password uses the same rule as Create Account: 8 or more characters, an uppercase letter, a lowercase letter, a number, and a symbol. A shorter password is refused before it is saved.

After the new password is saved, the app opens the kitchen for a PlateMaker and home for a PlateTaker. The role is the account on the link.

## Signed in

A reset link is applied before the form is shown. The account already on the phone is not the account that changes.

- A PlateMaker who is signed in and opens a PlateTaker's link sets the PlateTaker's password. This phone then follows that PlateTaker to home.
- A PlateTaker who is signed in and opens a PlateMaker's link sets the PlateMaker's password. This phone then follows that PlateMaker to the kitchen.
- The same role on both sides sets the password for the account on the link. After it is saved, a PlateMaker opens the kitchen and a PlateTaker opens home.

The password that was already on the phone is left as it was. An invalid or expired link stays on this screen and does not save a password for either account. The new password uses the same Create Account rule for both roles.

Privacy and Security, while signed in, uses that same rule for Change Password. Signed out, that screen is not available. Web, iOS, and Android use this source. The website publish on `main` includes this screen. The iOS and Android store builds stay on the previous copy until a new build.
