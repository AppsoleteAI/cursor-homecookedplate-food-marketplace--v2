export function canPublishMeal(input: {
  name: string;
  price: number;
  photoCount: number;
  foodSafetyAcknowledged: boolean;
}): boolean {
  return (
    input.name.trim().length > 0 &&
    Number.isFinite(input.price) &&
    input.price > 0 &&
    input.photoCount >= 1 &&
    input.foodSafetyAcknowledged
  );
}

export function cuisineToMealCategory(cuisine: string): 'dinner' | 'dessert' {
  return cuisine.trim() === 'Bakery' ? 'dessert' : 'dinner';
}

export function parseIngredientList(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter((part) => part.length > 0);
}
