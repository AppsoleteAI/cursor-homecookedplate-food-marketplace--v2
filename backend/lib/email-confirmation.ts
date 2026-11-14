/** Login is allowed only after the custom verify-email route confirms the address. */
export const CONFIRMATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export const CONFIRMATION_EXPIRED_MESSAGE = 'Your confirmation link expired after 24 hours. Open Confirm email to send a new one.';

/** Same sentence for an unknown address and for a new link that was stored and sent. */
export const RESEND_CONFIRMATION_MESSAGE =
  'If an account exists with this email, a new verification link has been sent.';

/** A confirmed address does not get another link. Sign-in uses the email and password. */
export const ALREADY_CONFIRMED_SIGN_IN_MESSAGE =
  'This address is already confirmed. Sign in with your email and password.';

/** The mail host refused, or the new link could not be stored. This does not confirm the address. */
export const CONFIRMATION_SEND_FAILED_MESSAGE =
  'The confirmation email could not be sent. Try again later.';

export function confirmationExpiresAt(now = Date.now()): string {
  return new Date(now + CONFIRMATION_WINDOW_MS).toISOString();
}

export function assertEmailConfirmed(emailConfirmedAt: string | null | undefined) {
  if (!emailConfirmedAt) {
    throw new Error('Confirm your email before signing in. Check your inbox for the verification link. The link lasts 24 hours.');
  }
}

/** True when the latest confirmation link is past its 24-hour end. */
export function confirmationWindowClosed(input: {
  expiresAt?: string | null;
  accountCreatedAt?: string | null;
  now?: number;
}): boolean {
  const now = input.now ?? Date.now();
  if (input.expiresAt) {
    const expires = Date.parse(input.expiresAt);
    return Number.isFinite(expires) && expires <= now;
  }
  if (input.accountCreatedAt) {
    const created = Date.parse(input.accountCreatedAt);
    return Number.isFinite(created) && now - created >= CONFIRMATION_WINDOW_MS;
  }
  return false;
}
