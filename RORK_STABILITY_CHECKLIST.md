# 🛡️ Rork Stability Checklist

This document contains the non-negotiable architectural rules to prevent **PreventRemoveContext** crashes and navigation race conditions in the Rork Homecooked Plate app.

## 1. The Root Layout Split (app/_layout.tsx)

* **Web Rule:** Must use a manual `<NavigationContainer>` with `{independent: true}` for Rork Lightning Preview compatibility.
* **Native Rule:** **Never** wrap the `<Stack />` in a manual `NavigationContainer`. Let Expo Router handle it.
* **Mounting Rule:** Native Stacks must only render **after** the `onLayout` event of the root `View` has fired to ensure the native bridge is ready.

### Implementation Pattern

```tsx
const [isNativeLayoutReady, setIsNativeLayoutReady] = useState(false);
const isWeb = Platform.OS === 'web';

const onLayoutRootView = useCallback(async () => {
  if (!isNativeLayoutReady && !isWeb) {
    navLogger.stateChange('app/_layout.tsx:LAYOUT_READY', 'native_layout_ready', undefined, {
      platform: Platform.OS,
    });
    setIsNativeLayoutReady(true);
  }
}, [isNativeLayoutReady, isWeb]);

const renderNavigation = () => {
  if (isWeb) {
    return (
      <NavigationContainer {...({ independent: true } as any)}>
        {navigationContent}
      </NavigationContainer>
    );
  }
  return isNativeLayoutReady ? navigationContent : null;
};

return (
  <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
    {renderNavigation()}
  </View>
);
```

---

## 2. The Auth Gate (app/index.tsx)

* **Declarative Only:** **Never** use `useEffect` with `router.replace()` for initial routing.
* **Pattern:** Always use the `<Redirect />` component.
* **Logic:**
  1. Show `ActivityIndicator` while `isLoading`.
  2. `<Redirect href="/(auth)/login" />` if not authenticated.
  3. `<Redirect href="/(tabs)/dashboard" />` if authenticated.

### Implementation Pattern

```tsx
export default function Index() {
  const { isAuthenticated, isLoading, user, session } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    navLogger.authDecision('app/index.tsx:REDIRECT_CHECK', false, undefined, '/(auth)/login');
    return <Redirect href="/(auth)/login" />;
  }

  if (!user) {
    navLogger.error('app/index.tsx:NULL_USER', 'User is null but isAuthenticated is true', undefined, {
      isAuthenticated,
      hasSession: !!session,
    });
    return <Redirect href="/(auth)/login" />;
  }

  const userRole = user.role;
  if (userRole === 'platemaker') {
    navLogger.authDecision('app/index.tsx:REDIRECT_CHECK', true, 'platemaker', '/(tabs)/dashboard');
    return <Redirect href="/(tabs)/dashboard" />;
  }

  navLogger.authDecision('app/index.tsx:REDIRECT_CHECK', true, 'platetaker', '/(tabs)/(home)/home');
  return <Redirect href="/(tabs)/(home)/home" />;
}
```

---

## 3. Tab Safety (app/(tabs)/_layout.tsx)

* **Session Guard:** If `isAuthenticated` becomes false, return `<Redirect href="/(auth)/login" />` immediately.
* **No Nulls:** Never return `null` when a session is missing; it orphans the navigation tree.

### Implementation Pattern

```tsx
export default function TabLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    navLogger.authDecision('app/(tabs)/_layout.tsx:REDIRECT', false, undefined, '/(auth)/login', {
      reason: 'session_expired_or_missing',
    });
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      {/* Tab screens */}
    </Tabs>
  );
}
```

---

## 4. Modal Integrity

* **Contextual Options:** Always include `<Stack.Screen options={{ presentation: 'modal' }} />` inside the modal file itself (e.g., `app/meal/[id].tsx`) to bind the context.
* **Param Safety:** Always handle missing `id` params with a fallback UI to prevent render crashes.

### Implementation Pattern

```tsx
export default function MealDetailModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    navLogger.routeChange('app/meal/[id].tsx:MODAL_MOUNT', `/meal/${id}`, undefined, {
      mealId: id,
    });
  }, [id]);

  if (!id) {
    navLogger.error('app/meal/[id].tsx:MISSING_ID', 'Meal ID parameter is missing', undefined, {
      location: 'app/meal/[id].tsx',
    });
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{ 
            headerShown: true, 
            title: 'Meal Details',
            presentation: 'modal',
          }} 
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Meal not found.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          title: 'Meal Details',
          presentation: 'modal',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Text>Close</Text>
            </TouchableOpacity>
          ),
        }} 
      />
      {/* Modal content */}
    </View>
  );
}
```

---

## 5. Instrumentation & Debugging

* **Logging:** Use `navLogger` from `@/lib/nav-logger` for all navigation-related events.
* **No Inline Fetches:** Do not use raw `fetch()` calls for debugging inside component render methods.
* **Production:** Ensure `NavigationErrorBoundary` is wrapping the root stack to catch race conditions and pipe them to Sentry.

### Navigation Logger Usage

```tsx
import { navLogger } from '@/lib/nav-logger';

// Log route changes
navLogger.routeChange('app/meal/[id].tsx:MODAL_MOUNT', `/meal/${id}`, undefined, {
  mealId: id,
});

// Log auth decisions
navLogger.authDecision('app/index.tsx:REDIRECT_CHECK', true, 'platemaker', '/(tabs)/dashboard');

// Log errors
navLogger.error('app/meal/[id].tsx:MISSING_ID', 'Meal ID parameter is missing', undefined, {
  location: 'app/meal/[id].tsx',
});

// Log state changes
navLogger.stateChange('app/_layout.tsx:LAYOUT_READY', 'native_layout_ready', undefined, {
  platform: Platform.OS,
});
```

### Error Boundary Pattern

```tsx
import * as Sentry from '@sentry/react-native';
import { navLogger } from '@/lib/nav-logger';

componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  const isNavError = error.message?.includes('NavigationContent') || 
                     error.message?.includes('PreventRemoveContext') ||
                     error.message?.includes('prevent remove context');

  // Log to Sentry with context
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: { ...errorInfo, isNavigationRaceCondition: isNavError },
      tags: { area: 'navigation' },
    });
  }

  // Use navLogger instead of hypothesis fetch calls
  navLogger.error('components/NavigationErrorBoundary.tsx:ERROR_CATCH', error, undefined, {
    retryCount: this.state.retryCount,
    isNavError,
    componentStack: errorInfo.componentStack?.substring(0, 500),
  });

  // Auto-retry logic for race conditions
  if (isNavError && this.state.retryCount < 3) {
    const delay = 1000 * (this.state.retryCount + 1); // Exponential backoff
    setTimeout(() => {
      this.setState((prev) => ({ hasError: false, retryCount: prev.retryCount + 1 }));
    }, delay);
  }
}
```

---

## Implementation Status Summary

| Layer | Fix Applied | Status |
| --- | --- | --- |
| **Root Layout** | Native `onLayout` Trigger | ✅ Verified |
| **Index Gate** | Declarative `<Redirect />` | ✅ Verified |
| **Tab Layout** | Auth Session Guard | ✅ Verified |
| **Error Boundary** | Sentry + Exponential Retry | ✅ Verified |
| **Modals** | Internal `Stack.Screen` Binding | ✅ Verified |

---

## How to Use This Checklist

If you notice Cursor attempting to add a `useEffect` to `app/index.tsx`, simply paste the contents of this checklist or reference the **Stability Triangle** in your prompt. It will immediately recognize that the code it's about to write violates the safety constraints of the New Architecture.

### The Stability Triangle

The navigation architecture follows a three-layer stability pattern:

1. **Root Layer (`_layout.tsx`):** The `onLayout` trigger ensures the `NavigationContent` is native-ready before the children mount.
2. **Gate Layer (`index.tsx`):** The declarative `<Redirect />` waits for the layout's render cycle to settle before pushing the new route.
3. **Tab Layer (`(tabs)/_layout.tsx`):** Acts as a safety net, ensuring that even if a user is deep in the app, an expired session triggers a clean redirection rather than a crash or a blank screen.

### Common Violations to Avoid

❌ **Don't:** Use `useEffect` with `router.replace()` in `app/index.tsx`
✅ **Do:** Use declarative `<Redirect />` components

❌ **Don't:** Return `null` when unauthenticated in `app/(tabs)/_layout.tsx`
✅ **Do:** Return `<Redirect href="/(auth)/login" />`

❌ **Don't:** Use arbitrary timeouts (e.g., `setTimeout(3000)`) for navigation mounting
✅ **Do:** Use `onLayout` events to detect when native views are ready

❌ **Don't:** Use inline `fetch()` calls for debugging in render methods
✅ **Do:** Use `navLogger` from `@/lib/nav-logger` for all navigation logging

❌ **Don't:** Define modal options only in parent `_layout.tsx`
✅ **Do:** Include `<Stack.Screen options={{ presentation: 'modal' }} />` inside the modal component itself

---

## Testing Checklist

Before committing navigation changes, verify:

- [ ] No `useEffect` with `router.replace()` in `app/index.tsx`
- [ ] No `null` returns for unauthenticated state in `app/(tabs)/_layout.tsx`
- [ ] No arbitrary timeouts for navigation mounting
- [ ] All modal screens include `<Stack.Screen />` inside the component
- [ ] All navigation logging uses `navLogger` instead of inline `fetch()` calls
- [ ] `NavigationErrorBoundary` wraps the root stack and uses Sentry
- [ ] Web platform uses `NavigationContainer` with `independent: true`
- [ ] Native platform does NOT use manual `NavigationContainer`

---

## Related Documentation

- `docs/NAVIGATION_FIXES_SUMMARY.md` - Detailed analysis of navigation issues and fixes
- `lib/nav-logger.ts` - Navigation logging utility
- `components/NavigationErrorBoundary.tsx` - Error boundary with Sentry integration
