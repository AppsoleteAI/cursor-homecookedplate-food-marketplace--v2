import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { Meal } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = '@favorites';

interface FavoritesState {
  favorites: Meal[];
  isFavorite: (mealId: string) => boolean;
  toggleFavorite: (meal: Meal) => void;
}

export const [FavoritesProvider, useFavorites] = createContextHook<FavoritesState>(() => {
  const [favorites, setFavorites] = useState<Meal[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const stored = await AsyncStorage.getItem(FAVORITES_KEY);
        if (stored) {
          setFavorites(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Failed to load favorites:', error);
      } finally {
        setIsLoaded(true);
      }
    };
    setTimeout(() => loadFavorites(), 0);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      const saveFavorites = async () => {
        try {
          await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
        } catch (error) {
          console.error('Failed to save favorites:', error);
        }
      };
      saveFavorites();
    }
  }, [favorites, isLoaded]);

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
