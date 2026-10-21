export const SIGN_IN_CODE_ATTEMPTS = 5;

/** A wrong code counts. The fifth wrong code closes that code. */
export function nextSignInAttempt(attempts: number | undefined): { attempts: number; locked: boolean } {
  const prior = Number.isInteger(attempts) && (attempts as number) > 0 ? (attempts as number) : 0;
  const next = prior + 1;
  return { attempts: next, locked: next >= SIGN_IN_CODE_ATTEMPTS };
}

type OpenSignInCode = {
  used?: boolean;
  expiresAt?: string;
  attempts?: number;
};

export const SIGN_IN_CODE_LOCKED_MESSAGE = 'That sign-in code is no longer valid. Sign in again to email a new one.';

/** Five wrong tries close the code. The open sign-in screen can then email another one. */
export function signInCodeWasLocked(stored: OpenSignInCode | null | undefined): boolean {
  if (!stored?.used) return false;
  const attempts = Number.isInteger(stored.attempts) && (stored.attempts as number) > 0 ? (stored.attempts as number) : 0;
  return attempts >= SIGN_IN_CODE_ATTEMPTS;
}

export function openSignInCanEmailNewCode(message: string): boolean {
  return message.includes('no longer valid');
}

/** An emailed code stays the one that is checked until it expires or five wrong tries close it. */
export function signInCodeStillOpen(stored: OpenSignInCode | null | undefined, now = Date.now()): boolean {
  if (!stored || stored.used) return false;
  const expiresAt = stored.expiresAt ? Date.parse(stored.expiresAt) : Number.NaN;
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  const attempts = Number.isInteger(stored.attempts) && (stored.attempts as number) > 0 ? (stored.attempts as number) : 0;
  return attempts < SIGN_IN_CODE_ATTEMPTS;
}
