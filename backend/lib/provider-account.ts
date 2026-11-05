import { MEMBERSHIP_INELIGIBLE_MESSAGE, NO_ACCOUNT_MESSAGE } from './sign-in-messages';

export type ProviderProfile = {
  role?: string | null;
  is_paused?: boolean | null;
  ordering_removed?: boolean | null;
  email_confirmed_at?: string | null;
};

const CONFIRM_EMAIL = 'Confirm your email before signing in. Check your inbox for the verification link. The link lasts 24 hours.';
const PAUSED = 'This account is paused. Reactivate it to sign in.';

/** A PlateMaker and a PlateTaker already on the account can finish. A new provider identity cannot. */
export function providerAccountBlock(profile: ProviderProfile | null | undefined): string | null {
  if (!profile || (profile.role !== 'platemaker' && profile.role !== 'platetaker')) {
    return NO_ACCOUNT_MESSAGE;
  }
  if (profile.is_paused) return PAUSED;
  if (profile.ordering_removed) return MEMBERSHIP_INELIGIBLE_MESSAGE;
  if (!profile.email_confirmed_at) return CONFIRM_EMAIL;
  return null;
}
