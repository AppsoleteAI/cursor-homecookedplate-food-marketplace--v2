/** Login is allowed only after the custom verify-email route confirms the address. */
export function assertEmailConfirmed(emailConfirmedAt: string | null | undefined) {
  if (!emailConfirmedAt) {
    throw new Error('Confirm your email before signing in. Check your inbox for the verification link.');
  }
}
