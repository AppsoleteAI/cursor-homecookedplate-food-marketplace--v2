/** Login is allowed only after the custom verify-email route confirms the address. */
export const CONFIRMATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export const CONFIRMATION_EXPIRED_MESSAGE = 'Your confirmation link expired after 24 hours. Open Confirm email to send a new one.';

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
