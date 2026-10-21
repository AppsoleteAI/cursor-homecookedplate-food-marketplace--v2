import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useMemo, useState } from 'react';

export interface Review {
  id: string;
  mealId: string;
  user: string;
  avatar?: string;
  rating: number;
  comment: string;
  date: string;
}

interface ReviewsState {
  reviews: Review[];
  addReview: (input: { mealId: string; rating: number; comment: string; username?: string }) => void;
  getMealReviews: (mealId: string) => Review[];
  getAggregates: (mealId: string) => { average: number; count: number };
  setCurrentUser: (username: string) => void;
}

export const [ReviewsProvider, useReviewsContext] = createContextHook<ReviewsState>(() => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [currentUser, setCurrentUser] = useState<string>('Guest');

  const addReview = useCallback((input: { mealId: string; rating: number; comment: string; username?: string }) => {
    const now = new Date().toISOString();
    const displayName = input.username ?? currentUser;
    const newItem: Review = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      mealId: input.mealId,
      user: displayName,
      avatar: undefined,
      rating: input.rating,
      comment: input.comment,
      date: now,
    };
    setReviews(prev => [newItem, ...prev]);
  }, [currentUser]);

  const getMealReviews = useCallback((mealId: string) => {
    const list = reviews.filter(r => r.mealId === mealId);
    return list.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [reviews]);

  const getAggregates = useCallback((mealId: string) => {
    const list = reviews.filter(r => r.mealId === mealId);
    const count = list.length;
    const average = count > 0 ? Number((list.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1)) : 0;
    return { average, count };
  }, [reviews]);

  const setUser = useCallback((username: string) => {
    setCurrentUser(username);
  }, []);

  return useMemo(() => ({ reviews, addReview, getMealReviews, getAggregates, setCurrentUser: setUser }), [reviews, addReview, getMealReviews, getAggregates, setUser]);
});