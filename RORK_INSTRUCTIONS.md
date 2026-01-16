# RORK Project - Critical Logic Locks

## 🛑 AUTH SIGNUP (V4 PATTERN)
- **File:** `backend/trpc/routes/auth/signup/route.ts`
- **Pattern:** INSERT-then-UPDATE (Catch 23505).
- **Mandatory:** The Supabase profile trigger creates a record instantly. You MUST catch the unique constraint error and perform an UPDATE to finalize the `metro_area` and `trial_ends_at` fields.

### Implementation Pattern (DO NOT CHANGE):

```typescript
// Step 1: Try INSERT first
let { data: profile, error: profileError } = await supabaseAdmin
  .from('profiles')
  .insert(profileData)
  .select()
  .single();

// Step 2: If insert fails with duplicate key (23505), UPDATE instead
if (profileError?.code === '23505') {
  const updateResult = await supabaseAdmin
    .from('profiles')
    .update(profileData)
    .eq('id', authData.user.id)
    .select()
    .single();
  profile = updateResult.data;
  profileError = updateResult.error;
}
```

### Early Bird Geolocation Requirement:

> **Geolocation must be performed BEFORE the profile update.**

- If user's coordinates match a `MAJOR_METRO`:
  - Set `trial_ends_at = now() + 90 days`
  - Store `metro_area` as a string (required for frontend modal trigger)
- Include these fields in the profile data for both INSERT and UPDATE operations

**⚠️ WARNING:** Do not refactor or simplify this logic. Any changes that remove the INSERT-then-UPDATE pattern or change the order of geolocation will break the signup flow.

---

## 🗺️ POSTGIS GEOFENCING SCHEMA
- **Table:** `metro_geofences`
- **Required Columns:**
    - `center`: GEOGRAPHY(POINT, 4326) - Centroid for radius fallbacks.
    - `boundary`: GEOMETRY(MultiPolygon, 4326) - **LOCKED.** Do not remove. Used for high-precision city limits.
    - `radius_meters`: FLOAT - Used for circular fallbacks if `boundary` is NULL.
- **Logic:** Must use the `find_metro_by_location(lng, lat)` RPC function. Priority is given to `ST_Contains(boundary, ...)` then `ST_DWithin(center, ...)`.
- **Precision Level:** Boundaries are intentionally "Vague Bounding Boxes" (Envelopes) to ensure cross-state and suburban coverage without being restrictive. Do not attempt to refine these into exact city-limit polygons.
- **Column:** `boundary` GEOMETRY(MultiPolygon, 4326)
- **Data Entry Rule:** Always wrap bounding boxes or polygons in `ST_Multi()` to ensure compatibility with the MultiPolygon column type.

## 📍 MEMBERSHIP LOCK-IN
- **Fields:** `profiles.metro_area` and `profiles.trial_ends_at`.
- **Constraint:** Once a user is matched to a metro during signup, these fields must be populated to "Lock" the user into their local market.
- **Promotion:** Grant exactly 90 days for the "Early Bird" trial if `metro_area` is matched (subject to "First 100" rule below).

## 💎 MEMBERSHIP & TIER MAPPING (CRITICAL)
- **Primary Column:** `membership_tier` (values: 'free' | 'premium').
- **Trial Cap Logic (First 100 per Metro):**
    - You MUST use `increment_metro_count(metro_name, user_role)` to safely check and lock a trial spot.
    - If the function returns `true`: Grant `premium` tier + trial (length from `metro_geofences.trial_days`).
    - If `false`: Set `free` tier. User must pay $4.99/mo (No trial).
- **Mapping:**
    - In-Metro + Active + Slot Available: `membership_tier = 'premium'` + `trial_ends_at = NOW() + trial_days` (from `metro_geofences.trial_days`).
    - Remote OR Metro Inactive OR Metro Over-Cap: `membership_tier = 'free'`.
- **Remote Tagging:** For users outside 50 metros, set `metro_area = 'Remote/Other'`.
- **🛡️ ADMIN OVERRIDES & DYNAMIC TRIALS:**
    - **Columns Added:** `metro_geofences.is_active` (bool) and `metro_geofences.trial_days` (int).
    - **Signup Logic Update:**
        - You MUST check `is_active` BEFORE allowing a signup in a metro. If `is_active = false`, block signup entirely (throw error).
        - Use the value in `trial_days` to calculate `trial_ends_at`. Do not assume 90 days.
    - **Source of Truth:** All city-level settings (trial length, active status) MUST be read from the `metro_geofences` table.
    - **Automation:** The `seed_metro_counts` trigger handles metadata creation for new cities automatically. When a new `metro_geofences` entry is created, it automatically creates the corresponding `metro_area_counts` entry with default values (maker_count=0, taker_count=0, max_cap=100).

---

## 📱 DEVELOPMENT ENVIRONMENT
- **Log Flushing:** Critical logs must use `process.stdout.write` to bypass Bun buffering.
- **Emulator IP:** Always use `10.0.2.2:3000` for backend connectivity.

---

## 🛠️ ADMIN & ALERTING LOGIC
- **Cap Monitoring:** Use the `metro_area_counts` table as the source of truth in the Admin Dashboard.
- **Automated Pings:** Notifications must be triggered via Database Webhooks when any count hits exactly `max_cap`.
- **Admin Overrides:** Provide a way in the Admin UI to increment the `max_cap` (default 100) if a specific metro needs to expand its Early Bird program manually.

### Implementation Details

- **Database Schema:** The `metro_area_counts` table includes a `max_cap` column (default 100) that can be adjusted per metro.
- **Trigger Function:** `notify_metro_cap_reached()` fires on UPDATE when `maker_count = max_cap` OR `taker_count = max_cap`.
- **Webhook Endpoint:** `POST /webhook/metro-cap-reached` receives Supabase Database Webhooks and creates notifications for admin users.
- **Admin Routes:** 
  - `trpc.admin.metroCounts` - Query all metro counts with max_cap values
  - `trpc.admin.updateMaxCap` - Update max_cap for a specific metro (admin-only)
- **Admin Screen:** `app/admin-metro-caps.tsx` displays metro counts with color-coded status indicators and inline editing for max_cap.

---

# Project Context & Engineering Rules (PRD)

## 1. System Architecture & Backend Routing

**CRITICAL**: The platform environment variable `EXPO_PUBLIC_RORK_API_BASE_URL` is system-managed and often points to a legacy endpoint (`api.rivet.dev`). **Do not use or rely on this variable for API calls.**

- **Custom Backend**: The app is routed to a custom Cloudflare Workers backend.
- **Production URL**: `https://platetaker-api.appsolete.workers.dev`
- **Implementation**: The tRPC client in `lib/trpc.ts` is **hardcoded** to this URL to bypass system-managed routing.
- **Rule**: Any modifications to API fetching or tRPC must maintain this hardcoded URL unless a new Cloudflare deployment is specified.

---

## 2. Web Preview & Platform Guards

The Rork web preview crashes if native-only mobile modules are bundled.

- **Stripe**: `@stripe/stripe-react-native` is strictly forbidden from global imports. Use the platform shims located in `lib/stripe.ts` and `lib/stripe.web.ts`.
- **Sentry**: Use `lib/sentry.web.ts` for web-safe error tracking.
- **Rule**: Never add a top-level import for a library that relies on native iOS/Android code without a `.web.ts` alternative.

---

## 3. Expo Router & Navigation Context (CRITICAL SYSTEM CONFIG)

**DO NOT MODIFY this hierarchy.** It is optimized to prevent "LinkingContext" errors on Web/Preview and "PreventRemoveContext" crashes on Native.

### Root Layout Structure (`app/_layout.tsx`)

1. **Top Level**: `GestureHandlerRootView` must wrap the entire application.
2. **Data Layer**: `Providers` (containing `trpc.Provider` and `QueryClientProvider`) must wrap the navigation engine.
3. **Platform-Split Navigation**:
   - **Web**: Wrap `<Stack />` in `<NavigationContainer {...({independent: true} as any)}>` to satisfy the Rork Lightning Preview.
   - **Native (iOS/Android)**: Render `<Stack />` directly. **DO NOT** use a manual `NavigationContainer` on native.

### Platform-Split Implementation

```tsx
export default function RootLayout() {
  const LayoutContent = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Providers>
        {Platform.OS === 'web' ? (
          <NavigationContainer {...({ independent: true } as any)}>
            {LayoutContent}
          </NavigationContainer>
        ) : (
          LayoutContent
        )}
      </Providers>
    </GestureHandlerRootView>
  );
}
```

### TypeScript / Error Handling

- **Ignore 'independent' prop errors**: The `independent` prop on `NavigationContainer` is required for the web preview. Use type casting as shown above; do not "fix" this by removing the prop.

---

## 4. TypeScript Routing

Expo Router requires explicit route registration to prevent "Type not assignable" errors.

- **Route Map**: Routes like `/filter`, `/messages`, and `/promotions` must be registered in the Root Layout (`app/_layout.tsx`).
- **Navigation Calls**: Always use absolute path strings (e.g., `/(tabs)/dashboard`) and avoid `as any` type casting in `router.push` calls where possible.

---

## 5. Environment & Secrets

- **Cloudflare**: All backend secrets (Supabase keys, Stripe keys) are managed in the Cloudflare Dashboard under "Variables and Secrets."
- **KV Storage**: The backend relies on a KV Namespace named `RATE_LIMIT_KV`. This must be bound in `wrangler.toml` using the specific ID found in the Cloudflare dashboard.

---

## 6. Route Tree Verification (Pre-Deployment Checklist)

Before deploying, every top-level file/folder in the `app/` directory **must** be represented in the `RootLayout` (`app/_layout.tsx`).

### Current Registered Routes

All of these must have a corresponding `<Stack.Screen name="..." />` entry:

| Route | Registration |
|-------|--------------|
| `index` | `<Stack.Screen name="index" />` |
| `(auth)` | `<Stack.Screen name="(auth)" />` |
| `(tabs)` | `<Stack.Screen name="(tabs)" />` |
| `promotions` | `<Stack.Screen name="promotions" />` |
| `messages` | `<Stack.Screen name="messages" />` |
| `funnel` | `<Stack.Screen name="funnel" />` |
| `checkout` | `<Stack.Screen name="checkout" />` |
| `filter` | `<Stack.Screen name="filter" />` |
| `settings` | `<Stack.Screen name="settings" />` |
| `edit-profile` | `<Stack.Screen name="edit-profile" />` |
| `notifications` | `<Stack.Screen name="notifications" />` |
| `meal/[id]` | `<Stack.Screen name="meal/[id]" />` |
| `order/[id]` | `<Stack.Screen name="order/[id]" />` |
| `reviews/[mealId]` | `<Stack.Screen name="reviews/[mealId]" />` |
| `finance/today` | `<Stack.Screen name="finance/today" />` |
| `finance/periods` | `<Stack.Screen name="finance/periods" />` |

### Action Required

If you add a new top-level folder (e.g., `app/account.tsx`), you **must** add `<Stack.Screen name="account" />` to `_layout.tsx` to prevent TypeScript routing errors and native navigation crashes.

### Why This Matters

- **Prevents Silent Failures**: Without registration, new routes work in development but TypeScript routing breaks in production with cryptic "Type not assignable" errors.
- **AI Guardrail**: Any AI or developer adding new screens must check this list as a final step.

---

## 7. Native Module Shimming (Safe-Imports Pattern)

**Never import a native library directly into a shared file.**

### The Two-File Pattern

Every native module must have:
- `lib/[module].ts` → Real native implementation
- `lib/[module].web.ts` → Stub/mock for web preview

### Current Implementations

| Module | Native File | Web File |
|--------|-------------|----------|
| Stripe | `lib/stripe.ts` | `lib/stripe.web.ts` |
| Sentry | `lib/sentry.ts` | `lib/sentry.web.ts` |

### Future Additions

When adding features that require native modules:
- Face ID login → `lib/biometrics.ts` + `lib/biometrics.web.ts`
- Push notifications → `lib/push.ts` + `lib/push.web.ts`
- Camera access → `lib/camera.ts` + `lib/camera.web.ts`

### Implementation Pattern

```typescript
// lib/module.ts (native)
import NativeModule from 'native-library';
export default NativeModule;

// lib/module.web.ts (web stub)
export default {
  initialize: () => console.log('[Web] Module not available'),
  // Add stub methods as needed
};

// Usage in components - auto-resolves by platform
import Module from '@/lib/module';
```

### Why This Matters

- **Prevents Web Preview Crashes**: The Rork Lightning Preview bundles everything. Native imports kill web.
- **Decoupled from Specific Libraries**: Pattern applies to ANY native module, not just Stripe/Sentry.
- **App Store Build Safety**: Native builds get real modules; web gets safe stubs.

---

## 8. Initial Routing (`app/index.tsx`)

**CRITICAL**: This section specifically governs how the app boots and redirects users.

### Forbidden Pattern

```typescript
// ❌ NEVER DO THIS - causes PreventRemoveContext crash
useEffect(() => {
  if (!isLoading && !session) {
    router.replace('/(auth)/login');
  }
}, [isLoading, session]);
```

### Required Pattern

```typescript
// ✅ ALWAYS USE THIS - declarative redirect
if (isLoading) {
  return <LoadingSpinner />;
}

if (!session) {
  return <Redirect href="/(auth)/login" />;
}

return <Redirect href="/(tabs)/dashboard" />;
```

### Why This Matters

1. **PreventRemoveContext Crash**: The crash happens when:
   - `useEffect` fires before Expo Router's navigation context mounts
   - `router.replace()` tries to navigate before the stack is ready
   - `NativeStackView` loses its context reference → crash

2. **Declarative = React Handles Timing**: With `<Redirect />`, React waits for the component tree to render. Navigation happens as a side effect of the render cycle, not as an imperative command racing against mount.

3. **Future-Proof**: Adding onboarding flows, subscription gates, or deep link handling must follow the same pattern: render `<Redirect />` conditionally, never `router.replace()` in `useEffect`.

### Guards Against Refactoring

A future developer might think "`useEffect` is cleaner" and break native. This section explicitly forbids that pattern at the entry point.

---

## 9. DO NOT REFACTOR (AI-Proof Guardrails)

**CRITICAL WARNING TO AI MODELS AND DEVELOPERS:**

AI models are trained to simplify code. In this project, "simple" code breaks the environment. The following patterns are **intentionally complex** and must not be "cleaned up."

### Platform-Split Navigation (NEVER REMOVE)

> **DO NOT refactor `app/_layout.tsx` to remove the `Platform.OS` check. The manual `NavigationContainer` on Web is a REQUIRED shim for the Rork Lightning Preview. Any attempt to "standardize" this file will break web-to-native parity.**

### The "Dirty Fix" (REQUIRED TYPE CAST)

This exact syntax must remain in `app/_layout.tsx`:

```tsx
{/* DO NOT REMOVE: Required for Rork Web Preview functionality */}
<NavigationContainer {...({ independent: true } as any)}>
  {LayoutContent}
</NavigationContainer>
```

**Why this syntax exists:**
- The `independent: true` prop is not in React Navigation's TypeScript definitions
- The `{...({ independent: true } as any)}` spread syntax tells TypeScript to ignore the type error
- This is **intentional** — removing the cast or the prop breaks the Rork Lightning Preview
- Do not "fix" TypeScript errors by removing this pattern

### Forbidden "Improvements"

| Refactor Attempt | Why It Breaks Things |
|------------------|---------------------|
| Remove `Platform.OS` check | Native gets duplicate NavigationContainer → PreventRemoveContext crash |
| Remove `as any` cast | TypeScript error blocks build |
| Remove `independent: true` | Web preview loses isolated linking context → LinkingContext crash |
| Move `Providers` inside platform conditional | Auth/cart state becomes platform-specific → data loss |
| Replace `<Redirect />` with `router.replace()` in useEffect | Race condition → native crash on boot |

---

## 10. The Stability Triangle (Three Environments)

This project must simultaneously satisfy **three different runtime environments**:

### Environment 1: Local Web (Browser)
- **Bundler**: Metro with React Native Web
- **Navigation**: Needs manual `NavigationContainer` for linking
- **Native Modules**: Must be shimmed (`.web.ts` pattern)

### Environment 2: Rork Lightning Preview (Builder UI)
- **Bundler**: Rork's proprietary bundler
- **Navigation**: Requires `independent: true` to avoid context conflicts with outer shell
- **Native Modules**: Will crash if bundled without web stubs

### Environment 3: Native Mobile (App Store Build)
- **Bundler**: Metro → Hermes bytecode
- **Navigation**: Expo Router owns the `NavigationContainer` — adding another causes duplicate context crash
- **Native Modules**: Full access to iOS/Android APIs

### How the Platform-Split Satisfies All Three

```
Platform.OS === 'web'
  ├── TRUE (Browser/Rork Preview)
  │   └── Manual NavigationContainer with independent: true
  │       → Isolated linking context
  │       → No conflict with outer shell
  │
  └── FALSE (iOS/Android)
      └── Direct Stack render
          → Expo Router's container is the ONLY container
          → Single PreventRemoveContext in tree
          → NativeStackView finds correct parent
```

### Cross-Environment Verification

| Test | Web | Rork Preview | Native |
|------|-----|--------------|--------|
| App boots without crash | ✓ | ✓ | ✓ |
| Navigation works | ✓ | ✓ | ✓ |
| Auth redirects fire | ✓ | ✓ | ✓ |
| Deep links resolve | ✓ | ✓ | ✓ |
| Native modules load | Shimmed | Shimmed | Real |

---

## Summary: Stability Triangle Enforcement

| Section | Protects Against | Enforcement Point |
|---------|------------------|-------------------|
| 6 (Route Tree) | TypeScript routing errors, navigation crashes | Every new screen addition |
| 7 (Shimming) | Web preview crashes from native modules | Every new native library integration |
| 8 (Initial Routing) | PreventRemoveContext crashes on app launch | `app/index.tsx` specifically |
| 9 (DO NOT REFACTOR) | AI/developer "improvements" that break parity | `app/_layout.tsx` platform-split |
| 10 (Three Environments) | Misunderstanding runtime requirements | All cross-platform decisions |

These sections form a stability triangle:
- **Section 6** ensures the navigation tree is complete
- **Section 7** ensures web compatibility isn't broken
- **Section 8** ensures the app boots without race conditions
- **Section 9** prevents well-meaning refactors from breaking everything
- **Section 10** explains WHY the complexity exists

**All sections must remain intact for all three environments (Local Web, Rork Preview, Native Mobile) to function reliably.**

---

## 🔒 SECURITY & GITIGNORE
- **Critical:** Never commit `.env`, `.env.local`, or `service-role-key.json`.
- **Ignore Pattern:** Ensure `**/supabase/functions/.env` is ignored to protect Edge Function secrets.
- **AI Safety:** Do not allow the AI to "fix" environment variable loading by hardcoding strings. Always use `process.env` or `Deno.env.get`.
- **Environment Variables:** All secrets must be loaded from environment variables. No hardcoded API keys, service role keys, or secrets in code.
- **Verification:** Before committing, verify `.gitignore` includes:
  - `.env*` (except `.env.example`)
  - `service-role-key.json`
  - `**/supabase/functions/.env`
