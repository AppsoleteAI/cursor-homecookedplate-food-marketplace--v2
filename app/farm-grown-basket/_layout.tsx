import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { hydrateFarmBasket } from '@/hooks/farm-basket-store';

export default function FarmGrownBasketLayout() {
  useEffect(() => {
    hydrateFarmBasket();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="market" />
      <Stack.Screen name="farms" />
      <Stack.Screen name="farm/[id]" />
      <Stack.Screen name="product/[id]" />
      <Stack.Screen name="csa" />
      <Stack.Screen name="logistics" />
      <Stack.Screen name="basket" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="seller" />
      <Stack.Screen name="list" />
      <Stack.Screen name="cottage-law" />
    </Stack>
  );
}
