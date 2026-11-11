import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inclusiveOfferEnd } from '../active-offer';
import { chargedPlateBase, offerIsCurrent, plateTotalsMatch, producedCost, promotionalBase } from '../fees';
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

describe('chargedPlateBase', () => {
  const now = new Date('2026-11-10T18:00:00.000Z');
  const live = {
    type: 'percentage' as const,
    discountPercentage: 25,
    isActive: true,
    startDate: '2026-11-01T00:00:00.000Z',
    endDate: '2026-11-20T23:59:59.999Z',
  };

  it('replaces the list price while the sale is on', () => {
    expect(chargedPlateBase(20, 2, live, now)).toBe(30);
  });

  it('returns the list price after the sale ends', () => {
    expect(chargedPlateBase(20, 2, { ...live, endDate: '2026-11-10T17:00:00.000Z' }, now)).toBe(40);
  });

  it('keeps a date-only end through that calendar day', () => {
    expect(chargedPlateBase(20, 1, { ...live, endDate: '2026-11-10T00:00:00.000Z' }, now)).toBe(15);
    expect(chargedPlateBase(20, 1, { ...live, endDate: '2026-11-10T00:00:00.000Z' }, new Date('2026-11-11T00:00:00.000Z'))).toBe(20);
  });

  it('returns the list price before the sale starts', () => {
    expect(offerIsCurrent({ ...live, startDate: '2026-11-11T00:00:00.000Z' }, now)).toBe(false);
    expect(chargedPlateBase(20, 1, { ...live, startDate: '2026-11-11T00:00:00.000Z' }, now)).toBe(20);
  });

  it('returns the list price when the sale is turned off', () => {
    expect(chargedPlateBase(20, 1, { ...live, isActive: false }, now)).toBe(20);
  });

  it('keeps a stored sale total that matches the offer', () => {
    expect(plateTotalsMatch(15, 15)).toBe(true);
    expect(plateTotalsMatch(20, 15)).toBe(false);
  });

  it('includes the chosen end date', () => {
    expect(inclusiveOfferEnd('2026-11-12T00:00:00.000Z')).toBe('2026-11-12T23:59:59.999Z');
  });
});

describe('sale price trigger', () => {
  const sql = readFileSync(resolve(__dirname, '../../sql/sale_price_overrides_list.sql'), 'utf8');

  it('charges the active offer and leaves the list price after that offer ends', () => {
    expect(sql).toContain('discount_percentage::numeric / 100.0');
    expect(sql).toContain("date_trunc('day', o.end_date at time zone 'utc')");
    expect(sql).toContain(') >= now()');
    expect(sql).toContain('charged := menu_total');
    expect(sql).toContain('new.total_price := charged');
    expect(sql).toContain('new.meal_id is not distinct from old.meal_id');
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
