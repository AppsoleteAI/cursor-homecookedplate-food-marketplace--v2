/** Which saved baskets a paid charge should empty. A food cart is the truck basket. A ghost kitchen is the sit-down basket. */
export function laneBasketsToClear(areas: readonly string[]) {
  const set = new Set(areas);
  return {
    farm: set.has('farm'),
    mealPrep: set.has('meal_prep'),
    truck: set.has('food_truck') || set.has('food_cart'),
    catering: set.has('catering'),
    sit: set.has('sit_down') || set.has('ghost_kitchen'),
  };
}
