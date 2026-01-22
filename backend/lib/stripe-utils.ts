/**
 * Stripe Price ID Selection Utility
 * 
 * Selects the correct Stripe price ID based on membership tier and Early Bird status.
 * 
 * Price Selection Logic (Payment & Redirect Architecture):
 * - SUCCESS (Early Bird trial granted) → Use Early Bird Trial Price ID
 * - CAP_REACHED or OUTSIDE_ZONE (Over-cap or Remote users) → Use Standard Monthly Price ID
 * 
 * @param membershipTier - Current membership tier ('premium' or 'free')
 * @param isEarlyBird - Whether user qualifies for Early Bird trial (SUCCESS from RPC)
 * @returns Stripe price ID string
 * 
 * Mapping:
 * - SUCCESS: isEarlyBird=true AND membershipTier='premium' → Early Bird Trial Price ID
 * - CAP_REACHED/OUTSIDE_ZONE: membershipTier='free' OR !isEarlyBird → Standard Monthly Price ID
 */
export function getStripePriceId(
  membershipTier: 'premium' | 'free',
  isEarlyBird: boolean
): string {
  // Get price IDs from environment variables (never hardcode - use env)
  const earlyBirdPriceId = process.env.STRIPE_PRICE_ID_EARLY_BIRD_TRIAL;
  const standardPriceId = process.env.STRIPE_PRICE_ID_MONTHLY || 'price_monthly_499';

  // SUCCESS: Early Bird users (isEarlyBird=true AND premium) get the trial price ID
  if (isEarlyBird && membershipTier === 'premium') {
    if (!earlyBirdPriceId) {
      console.warn(
        '[Stripe Utils] STRIPE_PRICE_ID_EARLY_BIRD_TRIAL not set, falling back to standard price'
      );
      return standardPriceId;
    }
    return earlyBirdPriceId;
  }

  // CAP_REACHED or OUTSIDE_ZONE: Remote users, Over-cap, or free tier use standard monthly price
  return standardPriceId;
}
