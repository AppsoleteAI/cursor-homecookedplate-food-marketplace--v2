/** Shown when the email or password does not match. */
export const WRONG_SIGN_IN_MESSAGE =
  'That email or password does not match. Check both and try again, or tap Forgot Password to set a new one.';

/** Shown when the email has no account, including one that was deleted. */
export const NO_ACCOUNT_MESSAGE = 'No account found. Create an account.';

/** Shown when the password matches an account that can no longer sign in. */
export const MEMBERSHIP_INELIGIBLE_MESSAGE = 'This account is no longer eligible for membership.';

export function isMissingAccountMessage(message: string): boolean {
  if (/seller profile not found/i.test(message)) return false;
  return /no account found|no account uses this email|profile not found/i.test(message);
}

export function isIneligibleAccountMessage(message: string): boolean {
  return /no longer eligible for membership|permanently banned/i.test(message);
}

/** The sign-in sentence for a missing or banned account, or null for any other error. */
export function accountAccessCopy(message: string): string | null {
  if (isIneligibleAccountMessage(message)) return MEMBERSHIP_INELIGIBLE_MESSAGE;
  if (isMissingAccountMessage(message)) return NO_ACCOUNT_MESSAGE;
  return null;
}
