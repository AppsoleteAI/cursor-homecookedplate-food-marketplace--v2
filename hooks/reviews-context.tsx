import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const REVIEWS_KEY = '@reviews';

export const [ReviewsProvider, useReviewsContext] = createContextHook<ReviewsState>(() => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>('Guest');
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(REVIEWS_KEY);
        if (stored) {
          const parsed: Review[] = JSON.parse(stored);
          if (mountedRef.current) {
            setReviews(Array.isArray(parsed) ? parsed : []);
          }
        }
      } catch (e) {
        console.error('[Reviews] Failed to load', e);
      } finally {
        if (mountedRef.current) {
          setLoaded(true);
        }
      }
    };
    load();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const save = async () => {
      try {
        await AsyncStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
      } catch (e) {
        console.error('[Reviews] Failed to save', e);
      }
    };
    save();
  }, [reviews, loaded]);

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
    if (!mountedRef.current) return;
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