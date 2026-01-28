# React Native DevTools Setup & Usage

## Overview

React Native DevTools is the modern debugging experience for React Native apps. It's built into React Native 0.76+ and provides a comprehensive debugging interface based on Chrome DevTools.

**Compatibility**: ✅ This project uses React Native 0.81.5, which fully supports React Native DevTools.

**Reference**: [Official React Native DevTools Documentation](https://reactnative.dev/docs/react-native-devtools)

---

## Quick Start

### Opening DevTools

1. **Start your development server**:
   ```bash
   bun run start
   ```

2. **Open DevTools**:
   - **iOS Simulator**: Press `Cmd + D` (or `Cmd + Ctrl + Z` on Mac)
   - **Android Emulator**: Press `Cmd + M` (Mac) or `Ctrl + M` (Windows/Linux)
   - **Physical Device**: Shake your device to open the developer menu, then tap "Open React Native DevTools"

3. **DevTools will automatically open** in your default browser at `http://localhost:8081/debugger-frontend/`

### Alternative: Direct URL Access

If DevTools doesn't open automatically, navigate to:
```
http://localhost:8081/debugger-frontend/
```

**Note**: If you encounter an `ENOENT` error for `index.html`, a symlink has been created to fix this. If the error persists, try:
- `http://localhost:8081/debugger-frontend/inspector.html` (Inspector)
- `http://localhost:8081/debugger-frontend/devtools_app.html` (DevTools App)

**Note**: Make sure your Metro bundler is running on port 8081 (default).

---

## Core Features

### 1. Console Panel

View and filter logs, evaluate JavaScript, and inspect object properties.

**Useful for this project**:
- Filter logs by level (errors, warnings, info)
- Use Live Expressions to watch values over time
- Persist messages across reloads with "Preserve Logs"
- Clear console with `Ctrl + L` (or `Cmd + L` on Mac)

**Project-specific tips**:
- The app uses logcat-style logging with unique tags (see `app/index.tsx`)
- Sentry errors will also appear in the console (development mode)

### 2. Sources & Breakpoints

Set breakpoints, step through code, and inspect live state.

**How to use**:
1. Navigate to a source file using the sidebar or `Cmd + P` / `Ctrl + P`
2. Click in the line number column to add a breakpoint
3. Use navigation controls to step through code when paused

**Project-specific tips**:
- Use `debugger;` statements in your code for quick breakpoints
- Breakpoints work with Fast Refresh - changes are reflected immediately
- The "Paused in Debugger" overlay appears when your app is paused

**Example**:
```typescript
// In any component or function
function handleSignup() {
  debugger; // Execution will pause here when DevTools is open
  // Your code here
}
```

### 3. Network Panel (Since RN 0.83)

View and inspect network requests made by your app.

**What's captured**:
- All `fetch()` calls
- `XMLHttpRequest` requests
- `<Image>` component loads
- Request/response headers, timings, and previews

**Project-specific usage**:
- Monitor tRPC calls to `https://plate-marketplace-api.appsolete.workers.dev`
- Inspect Supabase API requests
- Check Stripe payment requests
- View image loading from Expo Image components

**Tips**:
- Use the "Initiator" tab to see the call stack
- Network events also appear in the Performance panel
- Response previews are cached (max 100MB buffer)

**Note**: This project uses Expo Fetch, which is fully supported. Expo-specific network events may also appear in a separate "Expo Network" panel.

### 4. Performance Panel (Since RN 0.83)

Record performance sessions to understand JavaScript execution timing.

**Features**:
- JavaScript execution timeline
- React Performance tracks
- Network events timeline
- Custom User Timings

**Project-specific usage**:
- Profile navigation transitions (Expo Router)
- Analyze tRPC query performance
- Identify slow component renders
- Monitor React Query cache operations

**How to use**:
1. Click the "Record" button in the Performance panel
2. Interact with your app
3. Stop recording
4. Analyze the flame graph

**Tips**:
- Use Annotations to label performance traces
- Share traces with teammates by downloading them
- Use `PerformanceObserver` API for custom telemetry

### 5. Memory Panel

Take heap snapshots and view memory usage over time.

**Useful for**:
- Identifying memory leaks
- Understanding memory usage patterns
- Debugging performance issues

**How to use**:
1. Click "Take heap snapshot" in the Memory panel
2. Filter objects using `Cmd + F` / `Ctrl + F`
3. Take allocation timeline reports to see memory usage over time

**Project-specific tips**:
- Monitor AsyncStorage usage
- Check React Query cache size
- Inspect Zustand store memory

### 6. React Components Panel

Inspect and update the rendered React component tree.

**Features**:
- Hover or select elements to highlight them on device
- View and modify props and state at runtime
- Locate elements by clicking "Select element" and tapping in the app

**Project-specific usage**:
- Inspect Expo Router navigation state
- Debug component props in the tab navigation
- Check React Query data in components
- View Zustand store state

**Tips**:
- Components optimized with React Compiler show a "Memo ✨" badge
- Enable "Highlight updates when components render" to see re-renders
- Modify props/state in the right panel to test different scenarios

### 7. React Profiler Panel

Record performance profiles to understand component render timing.

**Features**:
- Flame graph visualization
- Component render timing
- React commit information

**How to use**:
1. Click "Record" in the Profiler panel
2. Interact with your app
3. Stop recording
4. Analyze the flame graph

**Project-specific usage**:
- Profile dashboard renders
- Analyze meal list performance
- Check navigation transition performance
- Optimize expensive component renders

---

## Reconnecting DevTools

DevTools may disconnect if:
- The app is closed
- The app is rebuilt (new native build installed)
- The app crashes on the native side
- Metro bundler is quit
- A physical device is disconnected

**To reconnect**:
1. A dialog will appear: "Debugging connection was closed"
2. Click "Reconnect DevTools" after addressing the disconnection reason
3. Or dismiss and manually open DevTools again

---

## Integration with Existing Debugging Tools

### Sentry Integration

React Native DevTools and Sentry work together:

- **DevTools**: Real-time debugging during development
- **Sentry**: Production error tracking and monitoring

**Best practices**:
- Use DevTools for active debugging sessions
- Use Sentry for production error monitoring
- Both tools can be used simultaneously

### Navigation Debugging

This project has navigation debugging documentation in `docs/NAVIGATION_DEBUGGING.md`. DevTools complements this:

- **DevTools**: Visual component tree and state inspection
- **Logcat/Console**: Text-based navigation logs

Use both for comprehensive navigation debugging.

---

## Project-Specific Debugging Scenarios

### Debugging Authentication Flow

1. **Set breakpoints** in `backend/trpc/routes/auth/signup/route.ts`
2. **Monitor network requests** to Supabase Auth API
3. **Inspect React state** in auth components
4. **Check console** for authentication errors

### Debugging Payment Flow

1. **Network panel**: Monitor Stripe API calls
2. **Console**: Check for payment errors
3. **React Components**: Inspect checkout component state
4. **Sources**: Set breakpoints in payment handlers

### Debugging Navigation Issues

1. **React Components**: Inspect navigation state
2. **Console**: Check for navigation errors
3. **Performance**: Profile navigation transitions
4. **Sources**: Set breakpoints in `app/index.tsx` routing logic

### Debugging tRPC Queries

1. **Network panel**: View tRPC request/response
2. **React Components**: Inspect React Query cache
3. **Console**: Check for query errors
4. **Performance**: Profile query execution time

---

## Troubleshooting

### DevTools Won't Open

1. **Check Metro bundler**: Ensure it's running on port 8081
2. **Check firewall**: Ensure port 8081 is not blocked
3. **Try direct URL**: Navigate to `http://localhost:8081/debugger-frontend/`
4. **If you get ENOENT error for index.html**: 
   - A symlink should already be created (see `DEBUGGER_FRONTEND_FIX.md`)
   - Or use: `http://localhost:8081/debugger-frontend/inspector.html`
5. **Use device menu instead**: Press `Cmd+M` (Android) or `Cmd+D` (iOS) and select "Open React Native DevTools"
6. **Restart Metro**: Stop and restart with `bun run start`

### Breakpoints Not Working

1. **Ensure DevTools is connected**: Check connection status
2. **Check source maps**: Ensure Metro is generating source maps
3. **Try `debugger;` statement**: This always works if DevTools is open
4. **Clear cache**: Run `bunx expo start --clear`

### Network Panel Not Showing Requests

1. **Check React Native version**: Network panel requires RN 0.83+ (you have 0.81.5)
   - **Note**: Network panel may not be available in RN 0.81.5
   - Use console logging or other debugging methods for network requests
2. **Ensure DevTools is open**: Network recording starts when DevTools opens
3. **Check request types**: Only `fetch()`, `XMLHttpRequest`, and `<Image>` are captured

### Performance Panel Not Available

1. **Check React Native version**: Performance panel requires RN 0.83+ (you have 0.81.5)
   - **Note**: Performance panel may not be available in RN 0.81.5
   - Use React Profiler panel instead for component performance

### Memory Panel Issues

1. **Large snapshots**: Heap snapshots can be large - be patient
2. **Filter results**: Use `Cmd + F` / `Ctrl + F` to filter objects
3. **Clear old snapshots**: Remove old snapshots to free memory

---

## Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Open DevTools | `Cmd + D` | `Ctrl + M` |
| Open file | `Cmd + P` | `Ctrl + P` |
| Clear console | `Cmd + L` | `Ctrl + L` |
| Search in heap | `Cmd + F` | `Ctrl + F` |
| Step over | `F10` | `F10` |
| Step into | `F11` | `F11` |
| Step out | `Shift + F11` | `Shift + F11` |
| Resume | `F8` | `F8` |

---

## Best Practices

1. **Use breakpoints strategically**: Don't set too many at once
2. **Filter console logs**: Use log levels to reduce noise
3. **Profile before optimizing**: Use Performance/Profiler to identify bottlenecks
4. **Monitor network requests**: Check for unnecessary API calls
5. **Inspect component state**: Use React Components panel to understand app state
6. **Take heap snapshots**: Periodically check for memory leaks
7. **Use Live Expressions**: Watch values change over time

---

## Additional Resources

- [React Native DevTools Documentation](https://reactnative.dev/docs/react-native-devtools)
- [Chrome DevTools Documentation](https://developer.chrome.com/docs/devtools/) (DevTools is based on Chrome DevTools)
- [React DevTools Documentation](https://react.dev/learn/react-developer-tools)
- [**Project-Specific Debugging Strategy**](./DEVTOOLS_DEBUGGING_STRATEGY.md) - Comprehensive guide for debugging navigation and rendering issues
- [Project Navigation Debugging Guide](./NAVIGATION_DEBUGGING.md)
- [Project Sentry Setup Guide](./SENTRY_SETUP.md)

---

## Version Compatibility

| Feature | Required RN Version | Status |
|---------|---------------------|--------|
| Core DevTools | 0.76+ | ✅ Available (RN 0.81.5) |
| Console Panel | 0.76+ | ✅ Available |
| Sources & Breakpoints | 0.76+ | ✅ Available |
| React Components | 0.76+ | ✅ Available |
| React Profiler | 0.76+ | ✅ Available |
| Memory Panel | 0.76+ | ✅ Available |
| Network Panel | 0.83+ | ⚠️ Not available (RN 0.81.5) |
| Performance Panel | 0.83+ | ⚠️ Not available (RN 0.81.5) |

**Note**: To access Network and Performance panels, consider upgrading to React Native 0.83+ when ready.

---

## Summary

React Native DevTools provides a comprehensive debugging experience for this project. While some features (Network and Performance panels) require RN 0.83+, the core debugging features are fully available and will significantly improve your development workflow.

**Key takeaways**:
- ✅ DevTools is built-in and works automatically
- ✅ Console, Sources, Memory, and React panels are fully functional
- ✅ Network and Performance panels require RN 0.83+ upgrade
- ✅ Integrates seamlessly with existing Sentry and navigation debugging
- ✅ Use breakpoints, console filtering, and component inspection for effective debugging
