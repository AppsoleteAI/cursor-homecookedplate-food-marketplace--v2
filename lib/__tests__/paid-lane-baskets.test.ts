import { laneBasketsToClear } from '@/lib/paid-lane-baskets';

describe('paid lane baskets', () => {
  it('clears the basket for each area on the charge, including a food cart and a ghost kitchen', () => {
    expect(laneBasketsToClear(['farm', 'food_cart', 'ghost_kitchen', 'meal_prep', 'catering'])).toEqual({
      farm: true,
      mealPrep: true,
      truck: true,
      catering: true,
      sit: true,
    });
    expect(laneBasketsToClear(['home', 'food_truck', 'sit_down'])).toEqual({
      farm: false,
      mealPrep: false,
      truck: true,
      catering: false,
      sit: true,
    });
  });
});
