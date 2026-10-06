import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { hydrateFoodTruck } from '@/hooks/food-truck-store';

export default function FoodTruckPopupLayout() {
  useEffect(() => {
    hydrateFoodTruck();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="board" />
      <Stack.Screen name="trucks" />
      <Stack.Screen name="truck/[id]" />
      <Stack.Screen name="item/[id]" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="basket" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="seller" />
      <Stack.Screen name="list" />
      <Stack.Screen name="permit" />
    </Stack>
  );
}
