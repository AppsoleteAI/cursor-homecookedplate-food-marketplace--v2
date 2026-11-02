import { applePayMerchantName, profilePayeeName } from '../payee-name';

describe('Apple Pay payee', () => {
  it('uses the cook name and not the platform name', () => {
    expect(profilePayeeName({ business_name: 'Ada Kitchen', username: 'ada' })).toBe('Ada Kitchen');
    expect(profilePayeeName({ business_name: ' ', username: 'ada' })).toBe('ada');
    expect(profilePayeeName({ business_name: 'A', username: 'ada' })).toBe('ada');
    expect(applePayMerchantName(['Ada Kitchen', 'Ada Kitchen', 'Ben Grill'])).toBe('Ada Kitchen, Ben Grill');
    expect(applePayMerchantName([])).toBe('Your cook');
    expect(applePayMerchantName(['A'.repeat(70)]).length).toBe(64);
  });
});
