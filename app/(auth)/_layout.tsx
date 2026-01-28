import { Stack } from 'expo-router';

export default function AuthLayout() {
  // FIXED: Removed router.replace() in useEffect - violates RORK_INSTRUCTIONS.md Section 8
  // Navigation is handled declaratively in app/index.tsx using <Redirect />
  // This prevents circular redirects and PreventRemoveContext crashes

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
      <Stack.Screen 
        name="recover" 
        options={{ 
          headerShown: false,
          gestureEnabled: true,
        }} 
      />
      <Stack.Screen 
        name="reset-password" 
        options={{ 
          headerShown: false,
          gestureEnabled: true,
        }} 
      />
    </Stack>
  );
}