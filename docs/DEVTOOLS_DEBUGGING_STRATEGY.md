# React Native DevTools: Debugging Strategy for Navigation & Rendering

## Overview

This guide explains how to use [React Native DevTools](https://reactnative.dev/docs/react-native-devtools) to systematically debug and fix navigation and rendering issues in this project, especially across mobile and web platforms.

**Reference**: [Official React Native DevTools Documentation](https://reactnative.dev/docs/react-native-devtools)

---

## Critical Issues to Debug

Based on the codebase, here are the key areas where DevTools will be most valuable:

1. **PreventRemoveContext crashes** - Navigation context errors on native
2. **Platform-specific navigation** - Web vs Native navigation container differences
3. **Auth-based routing** - Redirect logic in `app/index.tsx`
4. **Component re-renders** - Performance issues causing navigation delays
5. **Three-environment compatibility** - Local Web, Rork Preview, Native Mobile

---

## Strategy 1: Debugging Navigation Flow with Sources & Breakpoints

### Problem: PreventRemoveContext Crashes

**Location**: `app/_layout.tsx` and `app/index.tsx`

**How DevTools Helps**:

1. **Set breakpoints in critical navigation points**:
   ```typescript
   // In app/index.tsx - line 177 (renderRedirect function)
   const renderRedirect = () => {
     debugger; // Pause here to inspect auth state
     if (!isAuthenticated) {
       // ...
     }
   }
   ```

2. **Step through navigation initialization**:
   - Set breakpoint at `app/_layout.tsx:151` (RootLayout function start)
   - Step through platform detection logic
   - Inspect when `NavigationContainer` is created vs when `Stack` renders

3. **Inspect navigation context availability**:
   - When paused, check the **Scope** panel (right side)
   - Look for `NavigationContainer` context
   - Verify `Platform.OS` value matches expected platform

**Debugging Steps**:

1. Open DevTools → Sources panel
2. Navigate to `app/index.tsx` (Cmd+P / Ctrl+P)
3. Set breakpoint at line 177 (`renderRedirect` function)
4. Reload app
5. When paused, inspect:
   - `isLoading` value in Scope panel
   - `isAuthenticated` value
   - `user` object structure
   - `Platform.OS` value
6. Step through each redirect condition (F10)
7. Check if navigation context exists before redirect

### Problem: Auth State Race Conditions

**Location**: `app/index.tsx` - Multiple useEffect hooks tracking auth state

**How DevTools Helps**:

1. **Set conditional breakpoints**:
   ```typescript
   // In DevTools Sources panel, right-click line number
   // Select "Add conditional breakpoint"
   // Condition: isLoading === false && isAuthenticated === undefined
   ```

2. **Watch expressions for auth state**:
   - Open **Watch** panel (right side when paused)
   - Add: `isLoading`, `isAuthenticated`, `user?.role`
   - Monitor how these change during navigation

3. **Use Live Expressions** (Console panel):
   - Click "Create Live Expression" (eye icon)
   - Add: `window.__REACT_NAVIGATION_STATE__` (if available)
   - Monitor navigation state in real-time

**Debugging Steps**:

1. Set breakpoint at `app/index.tsx:30` (Index component)
2. Add watch expressions for all auth-related state
3. Step through each `useEffect` hook (lines 38, 54, 66, 96, 105, 137)
4. Note the order of execution
5. Check if state updates happen before redirects

---

## Strategy 2: Inspecting Navigation State with React Components Panel

### Problem: Navigation Container Context Issues

**Location**: `app/_layout.tsx` - Platform-specific NavigationContainer wrapping

**How DevTools Helps**:

1. **Inspect component tree**:
   - Open **React Components** panel
   - Find `RootLayout` component
   - Expand to see `NavigationContainer` (web) or `Stack` (native)
   - Verify the component hierarchy matches expected platform

2. **Check component props**:
   - Select `NavigationContainer` in component tree
   - View **Props** panel (right side)
   - Verify `independent: true` prop exists on web
   - Verify `NavigationContainer` is NOT present on native

3. **Highlight components on device**:
   - Click "Select element" button (top-left of Components panel)
   - Tap any element in the app
   - DevTools will highlight the component in the tree
   - Useful for identifying which component is rendering

**Debugging Steps**:

1. Open DevTools → React Components panel
2. Select `RootLayout` component
3. Expand component tree to see navigation structure
4. **On Web**: Verify `NavigationContainer` wraps `Stack`
5. **On Native**: Verify `Stack` is direct child (no `NavigationContainer`)
6. Check props of `NavigationContainer` (web only):
   - Should have `independent: true`
   - Should NOT have duplicate `NavigationContainer` children

### Problem: Route Registration Issues

**Location**: `app/_layout.tsx` - Stack.Screen registrations

**How DevTools Helps**:

1. **Inspect Stack configuration**:
   - Find `RootLayoutNavContent` component
   - Expand to see all `Stack.Screen` children
   - Count registered routes vs actual route files
   - Verify all routes from `RORK_INSTRUCTIONS.md` Section 6 are present

2. **Check route options**:
   - Select any `Stack.Screen` component
   - View props to see `name` and `options`
   - Verify modal routes have correct `presentation: "modal"`

**Debugging Steps**:

1. Open React Components panel
2. Find `RootLayoutNavContent` → `Stack` → All `Stack.Screen` children
3. Compare with route list in `RORK_INSTRUCTIONS.md`:
   - `index` ✓
   - `(auth)` ✓
   - `(tabs)` ✓
   - `promotions` ✓
   - `messages` ✓
   - ... (verify all 17 routes)
4. If route missing → Add to `_layout.tsx`
5. If route has wrong options → Fix `options` prop

---

## Strategy 3: Performance Debugging for Rendering Issues

### Problem: Excessive Re-renders Causing Navigation Delays

**Location**: Multiple components, especially `app/index.tsx` with multiple `useEffect` hooks

**How DevTools Helps**:

1. **Enable re-render highlighting**:
   - Open React Components panel
   - Click View Settings (⚙️ icon)
   - Check "Highlight updates when components render"
   - Watch components flash when they re-render

2. **Use React Profiler**:
   - Open **React Profiler** panel
   - Click "Record" button
   - Navigate through app (login → dashboard)
   - Stop recording
   - Analyze flame graph:
     - Look for components with long render times
     - Identify components rendering unnecessarily
     - Check commit frequency

3. **Identify render causes**:
   - In Profiler, select a commit
   - View which components rendered and why
   - Check "Why did this render?" for each component
   - Common causes: props changed, state changed, parent re-rendered

**Debugging Steps**:

1. Enable re-render highlighting
2. Start Profiler recording
3. Perform navigation action (e.g., login)
4. Stop recording
5. Analyze:
   - How many times `Index` component rendered?
   - Which `useEffect` hooks triggered re-renders?
   - Are there unnecessary re-renders before redirect?
6. Optimize:
   - Add `React.memo` to prevent unnecessary re-renders
   - Combine `useEffect` hooks if possible
   - Use `useMemo` for expensive computations

### Problem: Navigation Transition Performance

**Location**: Route transitions, especially auth redirects

**How DevTools Helps**:

1. **Profile navigation transitions**:
   - Record Profiler session
   - Trigger navigation (e.g., login redirect)
   - Analyze time between redirect decision and screen render
   - Identify slow components blocking navigation

2. **Check React Performance tracks** (RN 0.83+):
   - If available, view Performance panel
   - See JavaScript execution timeline
   - Identify long-running tasks blocking navigation

**Debugging Steps**:

1. Start Profiler recording
2. Trigger navigation (login → dashboard redirect)
3. Stop recording
4. Find the commit where redirect happens
5. Measure time from redirect decision to screen render
6. Identify slow operations:
   - Auth state checks?
   - Data fetching?
   - Component mounting?
7. Optimize slow operations or move them after navigation

---

## Strategy 4: Console-Based Navigation Debugging

### Problem: Navigation Events Not Logging Correctly

**Location**: `app/index.tsx` - Multiple console.log statements with `[INDEX]` and `[NAV_LOGGER]` tags

**How DevTools Helps**:

1. **Filter console logs**:
   - Open **Console** panel
   - Use filter box to show only navigation logs:
     - Filter: `NAV_LOGGER` or `INDEX`
     - Filter by log level (errors, warnings, info)
   - Clear console (Ctrl+L / Cmd+L) before testing

2. **Use Live Expressions**:
   - Create live expression: `window.__NAV_STATE__` (if available)
   - Monitor navigation state changes in real-time
   - Watch for state inconsistencies

3. **Evaluate navigation state**:
   - In Console, type: `$r` (references last selected component in Components panel)
   - Or evaluate: `useAuth()` (if available in scope)
   - Check current auth state without breakpoints

**Debugging Steps**:

1. Open Console panel
2. Filter: `NAV_LOGGER` or `INDEX`
3. Clear console (Ctrl+L)
4. Trigger navigation action
5. Observe log sequence:
   - `[INDEX] Auth state` - Initial state
   - `[INDEX] State CHANGE detected` - State updates
   - `[NAV_LOGGER] REDIRECT` - Redirect decisions
   - `[NAV_LOGGER] ROUTE_CHANGE` - Actual navigation
6. Identify missing logs or incorrect sequence
7. If logs missing → Check if `__DEV__` is true
8. If sequence wrong → Check `useEffect` dependencies

---

## Strategy 5: Platform-Specific Debugging

### Problem: Web vs Native Navigation Differences

**Location**: `app/_layout.tsx` - Platform.OS conditional rendering

**How DevTools Helps**:

1. **Debug on both platforms**:
   - **Web**: Open DevTools in browser (F12)
   - **Native**: Open React Native DevTools (Cmd+D / Cmd+M)
   - Compare component trees between platforms
   - Verify `Platform.OS` value matches expected

2. **Inspect platform-specific code paths**:
   - Set breakpoint at `app/_layout.tsx:211` (Platform.OS check)
   - Step through web path vs native path
   - Verify correct code path executes

3. **Check NavigationContainer presence**:
   - Use React Components panel
   - Search for `NavigationContainer` in component tree
   - **Web**: Should exist with `independent: true`
   - **Native**: Should NOT exist (Expo Router provides it)

**Debugging Steps**:

1. **Test on Web**:
   - Open browser DevTools + React Native DevTools
   - Verify `Platform.OS === 'web'` in Scope panel
   - Check component tree for `NavigationContainer`
   - Verify `independent: true` prop exists

2. **Test on Native** (iOS/Android):
   - Open React Native DevTools
   - Verify `Platform.OS !== 'web'` in Scope panel
   - Check component tree - `NavigationContainer` should NOT exist
   - Verify `Stack` is direct child of providers

3. **Compare behavior**:
   - Same navigation action on both platforms
   - Compare component trees
   - Compare console logs
   - Identify platform-specific issues

---

## Strategy 6: Memory Debugging for Navigation Leaks

### Problem: Memory leaks causing navigation slowdowns

**Location**: Multiple components, especially context providers

**How DevTools Helps**:

1. **Take heap snapshots**:
   - Open **Memory** panel
   - Take snapshot before navigation
   - Perform navigation action
   - Take snapshot after navigation
   - Compare snapshots to find memory leaks

2. **Filter for navigation-related objects**:
   - In heap snapshot, search for:
     - `NavigationContainer`
     - `Stack`
     - `Router`
     - `NavigationState`
   - Check if objects are retained after navigation

3. **Allocation timeline**:
   - Record allocation timeline
   - Navigate through app
   - Stop recording
   - Identify objects allocated but not freed

**Debugging Steps**:

1. Open Memory panel
2. Take initial heap snapshot
3. Navigate through app (login → dashboard → home)
4. Take final heap snapshot
5. Compare snapshots:
   - Filter: `Navigation`
   - Check for retained navigation objects
   - Identify components not unmounting
6. Fix leaks:
   - Ensure cleanup in `useEffect` return functions
   - Remove event listeners
   - Clear timers/intervals

---

## Strategy 7: Network Debugging for Navigation-Dependent API Calls

### Problem: API calls blocking navigation or causing errors

**Location**: tRPC calls, Supabase auth, etc.

**How DevTools Helps**:

**Note**: Network panel requires RN 0.83+, but this project uses RN 0.81.5. Use Console and Sources instead.

1. **Monitor API calls in Console**:
   - Filter console for network-related logs
   - Look for tRPC request/response logs
   - Check for failed requests blocking navigation

2. **Set breakpoints in API calls**:
   - Set breakpoint in `lib/trpc.ts` (tRPC client)
   - Step through request/response
   - Check if errors prevent navigation

3. **Use Sources to inspect network code**:
   - Navigate to `lib/trpc.ts` in Sources panel
   - Set breakpoint at request initiation
   - Inspect request payload and response

**Alternative for RN 0.81.5**:

- Use `console.log` with network request details
- Use React Query DevTools (if available) to inspect cache
- Use browser DevTools Network panel (web only)

---

## Practical Debugging Workflow

### Step-by-Step: Debugging a Navigation Issue

1. **Reproduce the issue**:
   - Note exact steps to reproduce
   - Note which platform (web/native)
   - Note error message (if any)

2. **Open DevTools**:
   - Start Metro: `bun run start`
   - Open DevTools: Cmd+D (iOS) or Cmd+M (Android)
   - Or navigate to `http://localhost:8081/debugger-frontend/`

3. **Set up debugging environment**:
   - Clear console (Ctrl+L)
   - Filter console for relevant logs
   - Enable re-render highlighting (Components panel)
   - Start Profiler recording (if performance-related)

4. **Set strategic breakpoints**:
   - `app/index.tsx:177` - Redirect logic
   - `app/_layout.tsx:151` - RootLayout initialization
   - `app/_layout.tsx:211` - Platform split decision

5. **Reproduce issue with breakpoints**:
   - Step through code (F10)
   - Inspect variables in Scope panel
   - Check component tree in Components panel
   - Monitor console for logs

6. **Analyze findings**:
   - Identify where issue occurs
   - Check if it's platform-specific
   - Check if it's timing-related (race condition)
   - Check if it's state-related (auth, navigation)

7. **Fix and verify**:
   - Make code changes
   - Fast Refresh will update app
   - Re-test with same breakpoints
   - Verify fix works on both platforms

---

## Specific Use Cases from This Project

### Use Case 1: Debugging PreventRemoveContext Crash

**Symptoms**: App crashes on Android with "Couldn't find the prevent remove context"

**DevTools Strategy**:

1. **Set breakpoint** at `app/_layout.tsx:211` (Platform.OS check)
2. **Inspect** if `NavigationContainer` is being created on native
3. **Check component tree** - Should NOT have `NavigationContainer` on native
4. **Verify** `Stack` is direct child of providers on native
5. **Fix**: Ensure `NavigationContainer` only wraps on web

### Use Case 2: Debugging Auth Redirect Logic

**Symptoms**: User redirected to wrong screen after login

**DevTools Strategy**:

1. **Set breakpoint** at `app/index.tsx:177` (renderRedirect)
2. **Add watch expressions**: `isLoading`, `isAuthenticated`, `user?.role`
3. **Step through** each redirect condition
4. **Check console** for `[NAV_LOGGER]` redirect logs
5. **Verify** redirect happens after auth state is ready
6. **Fix**: Adjust `useEffect` dependencies or add loading state checks

### Use Case 3: Debugging Web Preview Navigation

**Symptoms**: Navigation works on native but not in Rork web preview

**DevTools Strategy**:

1. **Open both** browser DevTools and React Native DevTools
2. **Check component tree** for `NavigationContainer` with `independent: true`
3. **Verify** `Platform.OS === 'web'` in Scope panel
4. **Set breakpoint** at web-specific code path
5. **Compare** component tree between web and native
6. **Fix**: Ensure web path uses `NavigationContainer` with `independent: true`

### Use Case 4: Debugging Slow Navigation Transitions

**Symptoms**: Navigation takes several seconds to complete

**DevTools Strategy**:

1. **Start Profiler recording**
2. **Trigger navigation** (e.g., login redirect)
3. **Stop recording** and analyze flame graph
4. **Identify** slow components or operations
5. **Check** if data fetching blocks navigation
6. **Fix**: Move slow operations to after navigation or add loading states

---

## Integration with Existing Debugging Tools

### DevTools + Logcat (Android)

- **DevTools**: Visual inspection, breakpoints, component tree
- **Logcat**: Text-based logs, system-level debugging
- **Use together**: DevTools for React issues, Logcat for native/system issues

### DevTools + Sentry

- **DevTools**: Real-time debugging during development
- **Sentry**: Production error tracking
- **Use together**: Debug in DevTools, monitor in Sentry

### DevTools + Navigation Logger

- **DevTools Console**: Filter and search navigation logs
- **Navigation Logger**: Structured logging with tags
- **Use together**: View logs in DevTools Console, use logger for structured data

---

## Best Practices

1. **Always test on both platforms**: Web and Native have different navigation implementations
2. **Use breakpoints strategically**: Don't set too many at once
3. **Enable re-render highlighting**: Helps identify unnecessary renders
4. **Profile before optimizing**: Use Profiler to find actual bottlenecks
5. **Clear console before testing**: Reduces noise in logs
6. **Use watch expressions**: Monitor key variables without breakpoints
7. **Compare component trees**: Web vs Native to identify differences
8. **Take heap snapshots**: Periodically check for memory leaks

---

## Summary

React Native DevTools provides comprehensive debugging capabilities for navigation and rendering issues:

- **Sources & Breakpoints**: Step through navigation logic, inspect state
- **React Components**: Visualize component tree, check navigation structure
- **Console**: Filter logs, monitor navigation events
- **Profiler**: Identify performance bottlenecks, unnecessary re-renders
- **Memory**: Find memory leaks affecting navigation
- **Platform-specific**: Debug web vs native differences

By combining these tools with the existing navigation logging and error tracking, you can systematically identify and fix navigation and rendering issues across all three environments (Local Web, Rork Preview, Native Mobile).

---

## References

- [React Native DevTools Documentation](https://reactnative.dev/docs/react-native-devtools)
- [Chrome DevTools Documentation](https://developer.chrome.com/docs/devtools/)
- [React DevTools Documentation](https://react.dev/learn/react-developer-tools)
- [Project Navigation Debugging Guide](./NAVIGATION_DEBUGGING.md)
- [Project DevTools Setup Guide](./REACT_NATIVE_DEVTOOLS.md)
