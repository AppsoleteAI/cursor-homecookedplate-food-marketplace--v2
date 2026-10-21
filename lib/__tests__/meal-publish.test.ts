import { canPublishMeal, cookTimeZoneFromTags, cuisineToMealCategory, parseIngredientList, pickupFitsWindow, pickupWindowNeedsCookZone, portionRowHolds, portionStatusHolds, portionsFromTags, timeZoneTag } from '../meal-publish';

describe('publishing a plate', () => {
  it('publishes with a name, a price, and one photo', () => {
    expect(canPublishMeal({
      name: 'Chicken plate',
      price: 14.99,
      photoCount: 1,
      preparationMinutes: 45,
      foodSafetyAcknowledged: true,
    })).toBe(true);
  });

  it('stays closed without a photo, a name, a price, or the food-safety acknowledgment', () => {
    const ready = {
      name: 'Chicken plate',
      price: 14.99,
      photoCount: 1,
      preparationMinutes: 45,
      foodSafetyAcknowledged: true,
    };
    expect(canPublishMeal({ ...ready, photoCount: 0 })).toBe(false);
    expect(canPublishMeal({ ...ready, name: '   ' })).toBe(false);
    expect(canPublishMeal({ ...ready, price: 0 })).toBe(false);
    expect(canPublishMeal({ ...ready, preparationMinutes: 0 })).toBe(false);
    expect(canPublishMeal({ ...ready, foodSafetyAcknowledged: false })).toBe(false);
  });

  it('maps a bakery plate to dessert and every other cuisine to dinner', () => {
    expect(cuisineToMealCategory('Bakery')).toBe('dessert');
    expect(cuisineToMealCategory(' Italian ')).toBe('dinner');
    expect(cuisineToMealCategory('')).toBe('dinner');
  });

  it('keeps a plate to one portion until a count is saved', () => {
    expect(portionsFromTags(undefined)).toBe(1);
    expect(portionsFromTags(['Mon 09:00-13:00', 'portions:4'])).toBe(4);
    expect(portionsFromTags(['portions:0'])).toBe(1);
    expect(portionStatusHolds('pending')).toBe(true);
    expect(portionStatusHolds('ready')).toBe(true);
    expect(portionStatusHolds('completed')).toBe(false);
    expect(portionStatusHolds('cancelled')).toBe(false);
    expect(portionRowHolds({ status: 'pending', paid: false })).toBe(false);
    expect(portionRowHolds({ status: 'pending', paid: true })).toBe(true);
    expect(portionRowHolds({ status: 'cancelled', paid: true })).toBe(false);
  });

  it('reads the cook time zone saved with the pickup days', () => {
    expect(timeZoneTag('America/New_York')).toBe('tz:America/New_York');
    expect(timeZoneTag('not a zone')).toBeNull();
    expect(cookTimeZoneFromTags(['Mon 09:00-13:00', 'tz:America/New_York'])).toBe('America/New_York');
    expect(cookTimeZoneFromTags(['Mon 09:00-13:00'])).toBeNull();
    expect(pickupFitsWindow(['Mon 09:00-13:00'], new Date('2026-10-19T14:00:00.000Z'), cookTimeZoneFromTags(['tz:America/New_York']))).toBe(true);
    expect(pickupWindowNeedsCookZone(['Mon 09:00-13:00'])).toBe(true);
    expect(pickupWindowNeedsCookZone(['Mon 09:00-13:00', 'tz:America/New_York'])).toBe(false);
    expect(pickupFitsWindow(['Mon 09:00-13:00'], new Date('2026-10-19T12:00:00.000Z'), null)).toBe(false);
  });

  it('accepts a pickup inside a saved window and rejects a different day', () => {
    const tags = ['Mon 09:00-13:00'];
    expect(pickupFitsWindow(tags, new Date('2026-10-19T14:00:00.000Z'), 'America/New_York')).toBe(true);
    expect(pickupFitsWindow(tags, new Date('2026-10-19T18:00:00.000Z'), 'America/New_York')).toBe(false);
    expect(pickupFitsWindow(['Tue 09:00-13:00'], new Date('2026-10-19T14:00:00.000Z'), 'America/New_York')).toBe(false);
    expect(pickupFitsWindow([], new Date('2026-10-19T14:00:00.000Z'), 'America/New_York')).toBe(true);
  });

  it('splits an ingredient list on commas', () => {
    expect(parseIngredientList(' Chicken, cream, , garlic ')).toEqual(['Chicken', 'cream', 'garlic']);
  });
});
