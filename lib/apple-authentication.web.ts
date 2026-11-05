/** Web has no Apple sheet. Apple sign-in uses the provider page. */
export const AppleAuthenticationScope = {
  FULL_NAME: 'FULL_NAME',
  EMAIL: 'EMAIL',
} as const;

export async function isAvailableAsync(): Promise<boolean> {
  return false;
}

export async function signInAsync(_options: {
  requestedScopes?: unknown[];
  nonce?: string;
}): Promise<{ identityToken: string | null }> {
  return { identityToken: null };
}
