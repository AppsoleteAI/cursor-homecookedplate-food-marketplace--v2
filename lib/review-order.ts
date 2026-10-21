export type ReviewOrderChoice = {
  id: string;
  mealId?: string | null;
  status?: string | null;
};

/** Completed orders for this plate that this buyer has not already reviewed. */
export function ordersLeftToReview<T extends ReviewOrderChoice>(
  orders: T[],
  mealId: string,
  reviewedOrderIds: string[],
): T[] {
  const reviewed = new Set(reviewedOrderIds.filter((id) => id.length > 0));
  return orders.filter((order) => order.mealId === mealId && order.status === 'completed' && !reviewed.has(order.id));
}

/**
 * One completed order is that review.
 * Several completed orders stay unchosen until the buyer picks one, including an older one.
 */
export function chosenReviewOrder<T extends ReviewOrderChoice>(choices: T[], selectedId: string | null): T | null {
  if (choices.length === 1) return choices[0];
  if (!selectedId) return null;
  return choices.find((order) => order.id === selectedId) ?? null;
}
