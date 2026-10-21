import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Meal } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/auth-context';

function favoritesKey(userId: string) {
  return `@favorites:${userId}`;
}

interface FavoritesState {
  favorites: Meal[];
  isFavorite: (mealId: string) => boolean;
  toggleFavorite: (meal: Meal) => void;
}

export const [FavoritesProvider, useFavorites] = createContextHook<FavoritesState>(() => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [favorites, setFavorites] = useState<Meal[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);
    setFavorites([]);
    if (!userId) {
      setIsLoaded(true);
      return;
    }
    const loadFavorites = async () => {
      try {
        const stored = await AsyncStorage.getItem(favoritesKey(userId));
        if (!cancelled && stored) {
          setFavorites(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Failed to load favorites:', error);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    };
    loadFavorites();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    const saveFavorites = async () => {
      try {
        await AsyncStorage.setItem(favoritesKey(userId), JSON.stringify(favorites));
      } catch (error) {
        console.error('Failed to save favorites:', error);
      }
    };
    saveFavorites();
  }, [favorites, isLoaded, userId]);

  const isFavorite = useCallback((mealId: string) => {
    return favorites.some(meal => meal.id === mealId);
  }, [favorites]);

  const toggleFavorite = useCallback((meal: Meal) => {
    setFavorites(prev => {
      const exists = prev.some(m => m.id === meal.id);
      if (exists) {
        return prev.filter(m => m.id !== meal.id);
      }
      return [...prev, meal];
    });
  }, []);

  return useMemo(() => ({
    favorites,
    isFavorite,
    toggleFavorite,
  }), [favorites, isFavorite, toggleFavorite]);
});
