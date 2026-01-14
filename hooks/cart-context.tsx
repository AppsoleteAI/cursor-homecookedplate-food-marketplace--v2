import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo } from 'react';
import { CartItem, Meal } from '@/types';

interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addToCart: (meal: Meal, quantity: number, options?: Partial<CartItem>) => void;
  removeFromCart: (mealId: string) => void;
  updateQuantity: (mealId: string, quantity: number) => void;
  updatePickupTime: (mealId: string, pickupTime: Date) => void;
  updateSpecialInstructions: (mealId: string, instructions: string) => void;
  updateAllergies: (mealId: string, allergies: string[]) => void;
  updateCookingTemperature: (mealId: string, temperature: string) => void;
  clearCart: () => void;
}

export const [CartProvider, useCart] = createContextHook<CartState>(() => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = useCallback((meal: Meal, quantity: number, options?: Partial<CartItem>) => {
    setItems(prev => {
      const existing = prev.find(item => item.meal.id === meal.id);
      if (existing) {
        return prev.map(item =>
          item.meal.id === meal.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { meal, quantity, ...options }];
    });
  }, []);

  const removeFromCart = useCallback((mealId: string) => {
    setItems(prev => prev.filter(item => item.meal.id !== mealId));
  }, []);

  const updateQuantity = useCallback((mealId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(item => item.meal.id !== mealId));
      return;
    }
    setItems(prev =>
      prev.map(item =>
        item.meal.id === mealId ? { ...item, quantity } : item
      )
    );
  }, []);

  const updatePickupTime = useCallback((mealId: string, pickupTime: Date) => {
    setItems(prev =>
      prev.map(item =>
        item.meal.id === mealId ? { ...item, pickupTime } : item
      )
    );
  }, []);

  const updateSpecialInstructions = useCallback((mealId: string, instructions: string) => {
    setItems(prev =>
      prev.map(item =>
        item.meal.id === mealId ? { ...item, specialInstructions: instructions || undefined } : item
      )
    );
  }, []);

  const updateAllergies = useCallback((mealId: string, allergies: string[]) => {
    setItems(prev =>
      prev.map(item =>
        item.meal.id === mealId ? { ...item, allergies: allergies.length > 0 ? allergies : undefined } : item
      )
    );
  }, []);

  const updateCookingTemperature = useCallback((mealId: string, temperature: string) => {
    setItems(prev =>
      prev.map(item =>
        item.meal.id === mealId ? { ...item, cookingTemperature: temperature || undefined } : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const totalPrice = useMemo(() => items.reduce((sum, item) => sum + item.meal.price * item.quantity, 0), [items]);

  return useMemo(() => ({
    items,
    totalItems,
    totalPrice,
    addToCart,
    removeFromCart,
    updateQuantity,
    updatePickupTime,
    updateSpecialInstructions,
    updateAllergies,
    updateCookingTemperature,
    clearCart,
  }), [items, totalItems, totalPrice, addToCart, removeFromCart, updateQuantity, updatePickupTime, updateSpecialInstructions, updateAllergies, updateCookingTemperature, clearCart]);
});