import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { hydrateMealPrep } from '@/hooks/meal-prep-store';
import { SectionGuestGate } from '@/components/GuestLimit';

export default function MealPrepGoLayout() {
  useEffect(() => {
    hydrateMealPrep();
  }, []);

  return (
    <SectionGuestGate root="/meal-prep-go">
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="board" />
      <Stack.Screen name="cooks" />
      <Stack.Screen name="cook/[id]" />
      <Stack.Screen name="item/[id]" />
      <Stack.Screen name="week" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="seller" />
      <Stack.Screen name="list" />
      <Stack.Screen name="kitchen" />
    </Stack>
    </SectionGuestGate>
  );
}
