import {
  accountAccessCopy,
  isIneligibleAccountMessage,
  isMissingAccountMessage,
  MEMBERSHIP_INELIGIBLE_MESSAGE,
  NO_ACCOUNT_MESSAGE,
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
});
