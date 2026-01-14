import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/auth-context';

export default function AuthLayout() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      if (user?.role === 'platemaker') {
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/(tabs)/(home)/home');
      }
    }
  }, [isAuthenticated, user, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen 
        name="signup" 
        options={{ 
          headerShown: false,
          gestureEnabled: true,
        }} 
      />
    </Stack>
  );
}