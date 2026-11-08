import { readFileSync } from 'fs';
import { join } from 'path';
import { metrosForTravelPlace, travelBrowseOpen } from '../travel-browse';

describe('travel browse', () => {
  it('opens another city for a paid PlateTaker and not for a cook or a free buyer', () => {
    expect(travelBrowseOpen({ role: 'platetaker', membership_tier: 'premium', stripe_subscription_id: 'sub' })).toBe(true);
    expect(travelBrowseOpen({ role: 'platetaker', membership_tier: 'free' })).toBe(false);
    expect(travelBrowseOpen({ role: 'platemaker', membership_tier: 'premium', stripe_subscription_id: 'sub' })).toBe(false);
  });

  it('matches New York and leaves a short name unmatched', () => {
    expect(metrosForTravelPlace('New York')).toEqual(['New York-Newark-Jersey City']);
    expect(metrosForTravelPlace('new')).toEqual([]);
  });

  it('keeps the order behind the 20 mile gate and the pickup window', () => {
    const rules = readFileSync(join(__dirname, '../plate-order-rules.ts'), 'utf8');
    const gate = rules.indexOf('await pickupGate');
    const window = rules.indexOf('if (!pickupFitsWindow');
    expect(gate).toBeGreaterThan(0);
    expect(window).toBeGreaterThan(gate);
  });
});
