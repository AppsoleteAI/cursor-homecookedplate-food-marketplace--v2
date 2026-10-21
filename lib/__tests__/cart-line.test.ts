import { buyerPlateLinkOpens, publicMenuKeepsPlate, savedFavoriteStaysOnDashboard, storedCartLineIsClosed } from '../cart-line';

describe('publicMenuKeepsPlate', () => {
  it('hides a plate when the cook is paused or not taking orders', () => {
    expect(publicMenuKeepsPlate(false, true)).toBe(true);
    expect(publicMenuKeepsPlate(true, true)).toBe(false);
    expect(publicMenuKeepsPlate(false, false)).toBe(false);
    expect(publicMenuKeepsPlate(false, null)).toBe(false);
  });
});

describe('storedCartLineIsClosed', () => {
  it('closes a stored line when the plate is missing or orders are off', () => {
    expect(storedCartLineIsClosed(true, false)).toBe(false);
    expect(storedCartLineIsClosed(false, false)).toBe(true);
    expect(storedCartLineIsClosed(undefined, true)).toBe(true);
    expect(storedCartLineIsClosed(undefined, false)).toBe(false);
  });
});

describe('buyer plate link and saved favorite', () => {
  it('keeps a buyer from opening a plate when orders are off, and the cook can still open it', () => {
    expect(buyerPlateLinkOpens(false, false, false)).toBe(false);
    expect(buyerPlateLinkOpens(false, null, false)).toBe(false);
    expect(buyerPlateLinkOpens(true, true, false)).toBe(false);
    expect(buyerPlateLinkOpens(false, true, false)).toBe(true);
    expect(buyerPlateLinkOpens(false, false, true)).toBe(true);
  });

  it('hides a saved favorite when that plate cannot be ordered', () => {
    expect(savedFavoriteStaysOnDashboard(true, false)).toBe(true);
    expect(savedFavoriteStaysOnDashboard(false, false)).toBe(false);
    expect(savedFavoriteStaysOnDashboard(undefined, true)).toBe(false);
    expect(savedFavoriteStaysOnDashboard(undefined, false)).toBe(true);
  });
});
