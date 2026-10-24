import { confirmationAlreadyDone, confirmationPath, tokenFromLink } from '@/lib/verification-link';

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

  it('treats a second open as confirmed', () => {
    expect(confirmationAlreadyDone('This verification link has already been used. Your email is already verified.')).toBe(true);
    expect(confirmationAlreadyDone('Invalid verification token. Please check your email and try again.')).toBe(false);
  });
});
