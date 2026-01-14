import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CreatedMeal, FreshnessAttachment, MealFreshness } from '@/types';

interface MealsState {
  meals: CreatedMeal[];
  isLoading: boolean;
  addMeal: (input: Omit<CreatedMeal, 'id' | 'createdAt'>) => Promise<CreatedMeal>;
  addFreshnessAttachment: (mealId: string, attachment: Omit<FreshnessAttachment, 'addedAt'>) => Promise<void>;
  getMyMeals: (ownerId: string) => CreatedMeal[];
}

const STORAGE_KEY = 'created_meals_v1';

export const [MealsProvider, useMeals] = createContextHook<MealsState>(() => {
  const [meals, setMeals] = useState<CreatedMeal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    const loadData = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Array<Omit<CreatedMeal, 'createdAt' | 'freshness'> & { createdAt: string; freshness: Omit<MealFreshness, 'attachments'> & { attachments: Array<Omit<FreshnessAttachment, 'addedAt'> & { addedAt: string }> } }>;
          const hydrated: CreatedMeal[] = parsed.map(m => ({
            ...m,
            createdAt: new Date(m.createdAt),
            freshness: {
              expiryDate: m.freshness.expiryDate,
              receiptDate: m.freshness.receiptDate,
              attachments: m.freshness.attachments.map(a => ({ ...a, addedAt: new Date(a.addedAt) })),
            },
          }));
          if (mountedRef.current) setMeals(hydrated);
        }
      } catch (e) {
        console.error('[Meals] load error', e);
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    };
    setTimeout(() => loadData(), 0);
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const persist = useCallback(async (next: CreatedMeal[]) => {
    try {
      const serializable = next.map(m => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        freshness: {
          ...m.freshness,
          attachments: m.freshness.attachments.map(a => ({ ...a, addedAt: a.addedAt.toISOString() })),
        },
      }));
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch (e) {
      console.error('[Meals] persist error', e);
    }
  }, []);

  const addMeal = useCallback(async (input: Omit<CreatedMeal, 'id' | 'createdAt'>) => {
    const meal: CreatedMeal = { ...input, id: `meal_${Date.now()}`, createdAt: new Date() };
    setMeals(prev => {
      const next = [meal, ...prev];
      persist(next).catch(err => console.error('[Meals] persist add error', err));
      return next;
    });
    return meal;
  }, [persist]);

  const addFreshnessAttachment = useCallback(async (mealId: string, attachment: Omit<FreshnessAttachment, 'addedAt'>) => {
    setMeals(prev => {
      const next = prev.map(m => (m.id === mealId ? { ...m, freshness: { ...m.freshness, attachments: [...m.freshness.attachments, { ...attachment, addedAt: new Date() }] } } : m));
      persist(next).catch(err => console.error('[Meals] persist attach error', err));
      return next;
    });
  }, [persist]);

  const getMyMeals = useCallback((ownerId: string) => meals.filter(m => m.ownerId === ownerId), [meals]);

  return useMemo(() => ({ meals, isLoading, addMeal, addFreshnessAttachment, getMyMeals }), [meals, isLoading, addMeal, addFreshnessAttachment, getMyMeals]);
});
