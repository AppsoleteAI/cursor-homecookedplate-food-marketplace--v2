import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { CartItem, Meal } from '@/types';
import { isSampleMealId } from '@/lib/sample-meals';
import { promotionalBase } from '@/lib/fees';
import { portionsFromTags } from '@/lib/meal-publish';
import { storedCartLineIsClosed } from '@/lib/cart-line';
import { trpcProxyClient } from '@/lib/trpc';
import { useAuth } from '@/hooks/auth-context';

interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addToCart: (meal: Meal, quantity: number, options?: Partial<CartItem>) => boolean;
  removeFromCart: (mealId: string) => void;
  updateQuantity: (mealId: string, quantity: number) => void;
  updatePickupTime: (mealId: string, pickupTime: Date) => void;
  updateSpecialInstructions: (mealId: string, instructions: string) => void;
  updateAllergies: (mealId: string, allergies: string[]) => void;
  updateCookingTemperature: (mealId: string, temperature: string) => void;
  clearCart: () => void;
}

export const [CartProvider, useCart] = createContextHook<CartState>(() => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const previousUserId = useRef<string | null>(user?.id ?? null);

  useEffect(() => {
    const nextId = user?.id ?? null;
    if (previousUserId.current && previousUserId.current !== nextId) {
      setItems([]);
    }
    previousUserId.current = nextId;
  }, [user?.id]);

  const cartIds = items.map((item) => item.meal.id).join(',');
  useEffect(() => {
    if (!cartIds) return;
    let cancelled = false;
    const ids = cartIds.split(',');
    const dropClosed = async () => {
      const closed: string[] = [];
      for (const id of ids) {
        try {
          const plate = await trpcProxyClient.meals.get.query({
            id,
            metroArea: user?.metroArea || undefined,
          });
          if (storedCartLineIsClosed(plate.acceptingOrders, false)) closed.push(id);
        } catch (error) {
          const message = error instanceof Error ? error.message : '';
          if (storedCartLineIsClosed(undefined, /not on the menu|Meal not found/i.test(message))) {
            closed.push(id);
          }
        }
      }
      if (cancelled || closed.length === 0) return;
      setItems((prev) => prev.filter((item) => !closed.includes(item.meal.id)));
    };
    void dropClosed();
    const timer = setInterval(() => { void dropClosed(); }, 30_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void dropClosed();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [cartIds, user?.metroArea]);

  const addToCart = useCallback((meal: Meal, quantity: number, options?: Partial<CartItem>) => {
    if (meal.isSample || isSampleMealId(meal.id) || meal.acceptingOrders === false) return false;
    const cap = portionsFromTags(meal.tags);
    const adding = Math.min(cap, Math.max(1, Math.round(quantity)));
    setItems(prev => {
      const existing = prev.find(item => item.meal.id === meal.id);
      if (existing) {
        return prev.map(item =>
          item.meal.id === meal.id
            ? { ...item, quantity: Math.min(cap, item.quantity + adding) }
            : item
        );
      }
      return [...prev, { meal, quantity: adding, ...options }];
    });
    return true;
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
        item.meal.id === mealId
          ? { ...item, quantity: Math.min(portionsFromTags(item.meal.tags), Math.round(quantity)) }
          : item
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
  const totalPrice = useMemo(() => items.reduce((sum, item) => (
    sum + promotionalBase(item.meal.price, Math.max(1, Math.round(item.quantity)), item.meal.promotionalOffer)
  ), 0), [items]);

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