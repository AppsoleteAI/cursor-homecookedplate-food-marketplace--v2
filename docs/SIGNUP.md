# Create Account

Create Account is the same form for a PlateMaker and a PlateTaker. Web, iOS, and Android use this source. The website publish on `main` includes this form on https://homecookedplate.com and https://homecookedplate.pages.dev. The iOS and Android store builds stay on the previous copy until a new build.

The screen is `app/(auth)/signup.tsx`. The first-run steps are `app/(auth)/onboarding.tsx`. Both call `hooks/useSignupForm.ts`.

## Signed out

This is the path that creates an account.

On Create Account, a PlateMaker chooses Sell Food and a PlateTaker chooses Order Food. On the first-run steps, a PlateMaker chooses Start Cooking and a PlateTaker chooses Order a Plate. Each role still has to pass the same checks. The username check must finish and say the name is free. A name that is taken, still being checked, or whose check failed does not create an account. A failed check can be tried again. That try still does not create an account unless the check then says the name is free.

The password still needs 8 or more characters, an uppercase letter, a lowercase letter, a number, and a symbol.

If creating the account fails, the message stays under the form until the username, email, or password is edited. One request is sent. The 15 second limit belongs to that request. When the limit is reached, that request is cancelled. A retry starts only after it has finished, and it does not send a second create while the first is still open.

After a PlateMaker account is created, the screen offers Choose Membership. After a PlateTaker account is created, the screen offers See Membership. Neither role is signed in until the email link is confirmed.

## Signed in

Opening Create Account while already signed in uses the same form. A PlateMaker choice and a PlateTaker choice still wait for a finished username check, keep a failure on the form, and send one create at a time. The account already on the phone is not replaced by the new account. Sign-in still waits for the email link.
