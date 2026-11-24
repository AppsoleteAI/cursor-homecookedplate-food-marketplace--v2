import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { hydrateSitDown } from '@/hooks/sit-down-store';
import { SectionGuestGate } from '@/components/GuestLimit';

export default function SitDownDeliciousLayout() {
  useEffect(() => {
    hydrateSitDown();
  }, []);

  return (
    <SectionGuestGate root="/sit-down-delicious">
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="places" />
      <Stack.Screen name="place/[id]" />
      <Stack.Screen name="item/[id]" />
      <Stack.Screen name="basket" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="seller" />
      <Stack.Screen name="list" />
      <Stack.Screen name="license" />
    </Stack>
    </SectionGuestGate>
  );
}
