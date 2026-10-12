import { canPublishMeal, cuisineToMealCategory, parseIngredientList } from '../meal-publish';

describe('publishing a plate', () => {
  it('publishes with a name, a price, and one photo', () => {
    expect(canPublishMeal({
      name: 'Chicken plate',
      price: 14.99,
      photoCount: 1,
      foodSafetyAcknowledged: true,
    })).toBe(true);
  });

  it('stays closed without a photo, a name, a price, or the food-safety acknowledgment', () => {
    const ready = {
      name: 'Chicken plate',
      price: 14.99,
      photoCount: 1,
      foodSafetyAcknowledged: true,
    };
    expect(canPublishMeal({ ...ready, photoCount: 0 })).toBe(false);
    expect(canPublishMeal({ ...ready, name: '   ' })).toBe(false);
    expect(canPublishMeal({ ...ready, price: 0 })).toBe(false);
    expect(canPublishMeal({ ...ready, foodSafetyAcknowledged: false })).toBe(false);
  });

  it('maps a bakery plate to dessert and every other cuisine to dinner', () => {
    expect(cuisineToMealCategory('Bakery')).toBe('dessert');
    expect(cuisineToMealCategory(' Italian ')).toBe('dinner');
    expect(cuisineToMealCategory('')).toBe('dinner');
  });

  it('splits an ingredient list on commas', () => {
    expect(parseIngredientList(' Chicken, cream, , garlic ')).toEqual(['Chicken', 'cream', 'garlic']);
  });
});
