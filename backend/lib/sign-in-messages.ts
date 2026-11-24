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

export type SignInFailure =
  | { kind: 'legal' }
  | { kind: 'save' }
  | { kind: 'ineligible' }
  | { kind: 'missing' }
  | { kind: 'validation' }
  | { kind: 'network' }
  | { kind: 'confirmation'; expired: boolean }
  | { kind: 'password' }
  | { kind: 'other'; message: string };

/** Email, Apple, and Google share this reading of a failed sign-in. */
export function classifySignInFailure(message: string, code = ''): SignInFailure {
  const expired = /expired after 24 hours/i.test(message);
  const confirmation = expired || /confirm your email|email not confirmed/i.test(message);
  if (message.includes('Complete the Legal & Safety page')) return { kind: 'legal' };
  if (message.includes('could not be saved')) return { kind: 'save' };
  if (isIneligibleAccountMessage(message)) return { kind: 'ineligible' };
  if (isMissingAccountMessage(message) || code === 'NOT_FOUND') return { kind: 'missing' };
  if (message.includes('invalid_format')) return { kind: 'validation' };
  if (/fetch|network|timeout|Failed to fetch/i.test(message)) return { kind: 'network' };
  if (confirmation) return { kind: 'confirmation', expired };
  if (/password does not match|invalid login credentials|invalid credentials/i.test(message) || !message.trim()) {
    return { kind: 'password' };
  }
  return { kind: 'other', message };
}
