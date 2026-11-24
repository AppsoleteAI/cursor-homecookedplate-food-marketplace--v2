import {
  accountAccessCopy,
  classifySignInFailure,
  isIneligibleAccountMessage,
  isMissingAccountMessage,
  MEMBERSHIP_INELIGIBLE_MESSAGE,
  NO_ACCOUNT_MESSAGE,
  REVOKED_SESSION_MESSAGE,
  REVOKED_SESSION_NOTICE_KEY,
  WRONG_SIGN_IN_MESSAGE,
} from '../sign-in-messages';

describe('sign-in account messages', () => {
  it('tells a missing or deleted account to create one', () => {
    expect(NO_ACCOUNT_MESSAGE).toBe('No account found. Create an account.');
    expect(isMissingAccountMessage(NO_ACCOUNT_MESSAGE)).toBe(true);
    expect(isMissingAccountMessage('No account uses this email.')).toBe(true);
    expect(isMissingAccountMessage('Profile not found')).toBe(true);
    expect(isMissingAccountMessage('That password does not match.')).toBe(false);
    expect(isMissingAccountMessage('Seller profile not found')).toBe(false);
    expect(accountAccessCopy('Seller profile not found')).toBeNull();
    expect(accountAccessCopy('This account is permanently banned after lost card disputes.')).toBe(MEMBERSHIP_INELIGIBLE_MESSAGE);
  });

  it('tells a banned account it is no longer eligible', () => {
    expect(MEMBERSHIP_INELIGIBLE_MESSAGE).toBe('This account is no longer eligible for membership.');
    expect(isIneligibleAccountMessage(MEMBERSHIP_INELIGIBLE_MESSAGE)).toBe(true);
    expect(isIneligibleAccountMessage('This account is permanently banned after lost card disputes.')).toBe(true);
    expect(isIneligibleAccountMessage(NO_ACCOUNT_MESSAGE)).toBe(false);
  });

  it('tells both roles when a saved sign-in has ended', () => {
    expect(REVOKED_SESSION_MESSAGE).toBe('This saved sign-in has ended. Sign in again.');
    expect(REVOKED_SESSION_NOTICE_KEY).toBe('hcp_sign_in_notice');
  });

  it('reads the same failure on email, Apple, and Google', () => {
    expect(classifySignInFailure('Complete the Legal & Safety page before signing in.').kind).toBe('legal');
    expect(classifySignInFailure('The Legal & Safety agreement could not be saved.').kind).toBe('save');
    expect(classifySignInFailure('No account found. Create an account.').kind).toBe('missing');
    expect(classifySignInFailure('missing', 'NOT_FOUND').kind).toBe('missing');
    expect(classifySignInFailure(MEMBERSHIP_INELIGIBLE_MESSAGE).kind).toBe('ineligible');
    expect(classifySignInFailure('Invalid login credentials').kind).toBe('password');
    expect(classifySignInFailure('').kind).toBe('password');
    expect(WRONG_SIGN_IN_MESSAGE).toContain('Forgot Password');
    expect(classifySignInFailure('Confirm your email before signing in.')).toEqual({ kind: 'confirmation', expired: false });
    expect(classifySignInFailure('This confirmation link expired after 24 hours.')).toEqual({ kind: 'confirmation', expired: true });
    expect(classifySignInFailure('Network error. Check your connection and try again.').kind).toBe('network');
  });
});
