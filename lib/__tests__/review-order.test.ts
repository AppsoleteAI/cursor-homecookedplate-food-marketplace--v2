import { chosenReviewOrder, ordersLeftToReview } from '../review-order';

describe('review order choice', () => {
  const newest = { id: 'new', mealId: 'plate', status: 'completed' };
  const older = { id: 'old', mealId: 'plate', status: 'completed' };

  it('leaves several completed orders unchosen until the buyer picks one', () => {
    const choices = ordersLeftToReview([newest, older], 'plate', []);
    expect(choices.map((order) => order.id)).toEqual(['new', 'old']);
    expect(chosenReviewOrder(choices, null)).toBeNull();
    expect(chosenReviewOrder(choices, 'old')?.id).toBe('old');
  });

  it('uses the only completed order and skips one that was already reviewed', () => {
    expect(chosenReviewOrder(ordersLeftToReview([newest], 'plate', []), null)?.id).toBe('new');
    expect(ordersLeftToReview([newest, older], 'plate', ['new']).map((order) => order.id)).toEqual(['old']);
  });
});
