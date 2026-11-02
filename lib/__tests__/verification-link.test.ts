import { confirmationAlreadyDone, confirmationPath, recoveryFromLink, tokenFromLink } from '@/lib/verification-link';

const token = 'a'.repeat(64);

describe('verification link', () => {
  it('reads the token from a web link, an app link, and a path', () => {
    expect(tokenFromLink(`https://homecookedplate.com/verify-email?token=${token}`)).toBe(token);
    expect(tokenFromLink(`homecookedplate:///verify-email?token=${token}`)).toBe(token);
    expect(tokenFromLink(`homecookedplate://verify-email?token=${token}`)).toBe(token);
    expect(tokenFromLink(`homecookedplate:///verify-email/${token}`)).toBe(token);
    expect(tokenFromLink(token)).toBe(token);
    expect(tokenFromLink('https://homecookedplate.com/verify-email')).toBeNull();
  });

  it('keeps the token when the native path is rewritten', () => {
    expect(confirmationPath(`homecookedplate:///verify-email?token=${token}`)).toBe(`/verify-email?token=${token}`);
    expect(confirmationPath(`homecookedplate:///verify-email/${token}`)).toBe(`/verify-email?token=${token}`);
    expect(confirmationPath('/')).toBeNull();
  });

  it('keeps the reset tokens that arrive after the hash', () => {
    const path = 'homecookedplate://(auth)/reset-password#access_token=abc&refresh_token=def&type=recovery';
    expect(confirmationPath(path)).toBe('/reset-password?access_token=abc&refresh_token=def&type=recovery');
    expect(confirmationPath('https://homecookedplate.com/reset-password?code=xyz')).toBe('/reset-password?code=xyz');
  });

  it('reads a recovery link from the hash and from the query', () => {
    const fromHash = recoveryFromLink('https://homecookedplate.com/reset-password#access_token=abc&refresh_token=def&type=recovery');
    expect(fromHash.accessToken).toBe('abc');
    expect(fromHash.refreshToken).toBe('def');
    expect(fromHash.type).toBe('recovery');
    const fromQuery = recoveryFromLink('/reset-password?token_hash=abc&type=recovery');
    expect(fromQuery.tokenHash).toBe('abc');
    expect(fromQuery.type).toBe('recovery');
  });

  it('treats a second open as confirmed', () => {
    expect(confirmationAlreadyDone('This verification link has already been used. Your email is already verified.')).toBe(true);
    expect(confirmationAlreadyDone('Invalid verification token. Please check your email and try again.')).toBe(false);
  });
});
