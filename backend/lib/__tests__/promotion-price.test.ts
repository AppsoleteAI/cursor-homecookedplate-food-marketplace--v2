import { producedCost, promotionalBase } from '../fees';
import { buyerMetroCanOrder, mealVisibleInMetro } from '../metro-menu';

describe('promotionalBase', () => {
  it('keeps the menu total when there is no offer', () => {
    expect(promotionalBase(12, 2, null)).toBe(24);
  });

  it('takes a percentage off the line', () => {
    expect(promotionalBase(20, 1, { type: 'percentage', discountPercentage: 25 })).toBe(15);
  });

  it('stops a percentage above 50 from changing the price', () => {
    expect(promotionalBase(20, 1, { type: 'percentage', discountPercentage: 50 })).toBe(10);
    expect(promotionalBase(20, 1, { type: 'percentage', discountPercentage: 51 })).toBe(20);
  });

  it('subtracts a fixed amount once for the line', () => {
    expect(promotionalBase(10, 2, { type: 'fixed-amount', discountAmount: 5 })).toBe(15);
  });

  it('stops an amount above $100 from changing the price', () => {
    expect(promotionalBase(120, 1, { type: 'fixed-amount', discountAmount: 100 })).toBe(20);
    expect(promotionalBase(120, 1, { type: 'fixed-amount', discountAmount: 100.01 })).toBe(120);
  });

  it('charges only the paid units in buy one get one', () => {
    expect(promotionalBase(8, 3, { type: 'buy-x-get-y', buyQuantity: 1, getQuantity: 1 })).toBe(16);
  });

  it('leaves the plate price unchanged for a free side', () => {
    expect(promotionalBase(9, 1, { type: 'free-item' })).toBe(9);
  });
});

describe('producedCost', () => {
  it('adds ingredients and packaging', () => {
    expect(producedCost(2.5, 0.25)).toBe(2.75);
  });
});

describe('mealVisibleInMetro', () => {
  it('hides a plate from another metro', () => {
    expect(mealVisibleInMetro('Austin-Round Rock-Georgetown', 'Pittsburgh')).toBe(false);
  });

  it('shows a plate from the same metro', () => {
    expect(mealVisibleInMetro('Pittsburgh', 'Pittsburgh')).toBe(true);
  });

  it('shows only remote cooks when the browser is remote', () => {
    expect(mealVisibleInMetro('Remote/Other', 'Remote/Other')).toBe(true);
    expect(mealVisibleInMetro('Pittsburgh', 'Remote/Other')).toBe(false);
    expect(mealVisibleInMetro(null, 'Remote/Other')).toBe(true);
  });

  it('hides every city when no metro was requested', () => {
    expect(mealVisibleInMetro('Pittsburgh', undefined)).toBe(false);
    expect(mealVisibleInMetro('Pittsburgh', '   ')).toBe(false);
  });
});

describe('buyerMetroCanOrder', () => {
  it('refuses a plate when the buyer has no saved metro', () => {
    expect(buyerMetroCanOrder('Pittsburgh', undefined)).toBe(false);
    expect(buyerMetroCanOrder('Pittsburgh', '   ')).toBe(false);
  });

  it('allows a plate only in the buyer saved metro', () => {
    expect(buyerMetroCanOrder('Pittsburgh', 'Pittsburgh')).toBe(true);
    expect(buyerMetroCanOrder('Austin-Round Rock-Georgetown', 'Pittsburgh')).toBe(false);
    expect(buyerMetroCanOrder('Remote/Other', 'Remote/Other')).toBe(true);
  });
});
