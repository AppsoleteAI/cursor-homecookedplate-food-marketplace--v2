import { plateCheckoutBlock } from '@/lib/plate-checkout-block';

describe('plate checkout block', () => {
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

  it('stops a sample, a past pickup, a missing cook clock, and too many portions', () => {
    expect(plateCheckoutBlock({
      mealId: 'meal-1',
      isSample: true,
      quantity: 1,
      pickupTime: future,
    })?.message).toBe('Sample plates are not for sale.');
    expect(plateCheckoutBlock({
      mealId: 'meal-1',
      quantity: 1,
      pickupTime: new Date(Date.now() - 120_000),
    })?.message).toBe('Choose a pickup time that has not passed.');
    expect(plateCheckoutBlock({
      mealId: 'meal-1',
      tags: ['Mon 11:00-13:00'],
      quantity: 1,
      pickupTime: future,
    })?.message).toBe('This plate has no cook time zone yet.');
    expect(plateCheckoutBlock({
      mealId: 'meal-1',
      tags: ['portions:1'],
      quantity: 2,
      pickupTime: future,
    })?.message).toBe('This plate does not have that many portions.');
  });

  it('allows a future pickup when the plate saved no days', () => {
    expect(plateCheckoutBlock({
      mealId: 'meal-1',
      tags: ['portions:2'],
      quantity: 1,
      pickupTime: future,
    })).toBeNull();
  });
});
