import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { membershipPriceCents } from '../fees';
import {
  APPLE_MEMBERSHIP_PRODUCT_IDS,
  GOOGLE_MEMBERSHIP_PRODUCT_IDS,
  assertMembershipProductRole,
  membershipStoreProductId,
} from '../membership-products';

const PLANS = [
  { role: 'platemaker' as const, interval: 'month' as const, cents: 499, apple: 'com.rork.homecookedplate.membership.monthly', google: 'com.rork.hcp.membership.monthly' },
  { role: 'platemaker' as const, interval: 'year' as const, cents: 3999, apple: 'com.rork.homecookedplate.membership.annual', google: 'com.rork.hcp.membership.annual' },
  { role: 'platetaker' as const, interval: 'month' as const, cents: 799, apple: 'com.rork.homecookedplate.platetaker.monthly', google: 'com.rork.hcp.platetaker.monthly' },
  { role: 'platetaker' as const, interval: 'year' as const, cents: 7599, apple: 'com.rork.homecookedplate.platetaker.annual', google: 'com.rork.hcp.platetaker.annual' },
];

describe('membership store products', () => {
  it('asks Apple and Google for the same role price the website charges', () => {
    for (const plan of PLANS) {
      expect(membershipPriceCents(plan.role, plan.interval)).toBe(plan.cents);
      expect(membershipStoreProductId('apple', plan.role, plan.interval)).toBe(plan.apple);
      expect(membershipStoreProductId('google', plan.role, plan.interval)).toBe(plan.google);
    }
    for (const id of GOOGLE_MEMBERSHIP_PRODUCT_IDS) {
      expect(id.length).toBeLessThanOrEqual(40);
    }
    expect(APPLE_MEMBERSHIP_PRODUCT_IDS).toHaveLength(4);
    expect(GOOGLE_MEMBERSHIP_PRODUCT_IDS).toHaveLength(4);
  });

  it('keeps a PlateTaker product off a PlateMaker account', () => {
    expect(() => assertMembershipProductRole('com.rork.hcp.platetaker.monthly', 'platemaker')).toThrow(/PlateTaker price/);
    expect(() => assertMembershipProductRole('com.rork.homecookedplate.platetaker.annual', 'platemaker')).toThrow(/PlateTaker price/);
    expect(() => assertMembershipProductRole('com.rork.hcp.platetaker.annual', 'platetaker')).not.toThrow();
    expect(() => assertMembershipProductRole('com.rork.homecookedplate.membership.monthly', 'platetaker')).not.toThrow();
    expect(() => assertMembershipProductRole('com.rork.hcp.membership.annual', 'platemaker')).not.toThrow();
    expect(() => assertMembershipProductRole('com.example.other', 'platetaker')).toThrow(/not a HomeCookedPlate membership/);
  });

  it('uses the role product on the membership screen and accepts it on both store receipts', () => {
    const screen = readFileSync(resolve(__dirname, '../../../app/membership.tsx'), 'utf8');
    const ios = readFileSync(resolve(__dirname, '../../../lib/iap.ios.ts'), 'utf8');
    const android = readFileSync(resolve(__dirname, '../../../lib/iap.android.ts'), 'utf8');
    const apple = readFileSync(resolve(__dirname, '../../trpc/routes/membership/confirm-apple/route.ts'), 'utf8');
    const google = readFileSync(resolve(__dirname, '../../trpc/routes/membership/confirm-google/route.ts'), 'utf8');
    expect(screen).toContain("membershipProductId(isPlateTaker ? 'platetaker' : 'platemaker', interval)");
    expect(screen).not.toContain('MEMBERSHIP_ANNUAL_PRODUCT_ID');
    expect(ios).toContain('APPLE_MEMBERSHIP_PRODUCT_IDS');
    expect(ios).toContain("membershipStoreProductId('apple'");
    expect(android).toContain('GOOGLE_MEMBERSHIP_PRODUCT_IDS');
    expect(android).toContain("membershipStoreProductId('google'");
    expect(apple).toContain('assertMembershipProductRole');
    expect(google).toContain('assertMembershipProductRole');
  });
});
