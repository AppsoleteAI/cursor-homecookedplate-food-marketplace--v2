import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { hydrateCaterEvent } from '@/hooks/cater-event-store';

export default function CaterEventDeliveredLayout() {
  useEffect(() => {
    hydrateCaterEvent();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="board" />
      <Stack.Screen name="companies" />
      <Stack.Screen name="company/[id]" />
      <Stack.Screen name="package/[id]" />
      <Stack.Screen name="calendar" />
      <Stack.Screen name="basket" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="seller" />
      <Stack.Screen name="list" />
      <Stack.Screen name="license" />
    </Stack>
  );
}
