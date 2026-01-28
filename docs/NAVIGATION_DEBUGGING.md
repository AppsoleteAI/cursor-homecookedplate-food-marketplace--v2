# Navigation Debugging with Android Logcat

This guide explains how to use Android logcat to debug navigation issues in the HomeCookedPlate app.

## Quick Start

### Option 1: Use the Helper Script

```bash
# Show all navigation logs
./scripts/nav-debug-logcat.sh all

# Show only errors
./scripts/nav-debug-logcat.sh errors

# Show navigation + package logs
./scripts/nav-debug-logcat.sh package

# Clear buffer and start fresh
./scripts/nav-debug-logcat.sh clear
```

### Option 2: Manual Commands

```bash
# All navigation logs
adb logcat | grep "NAV_LOGGER"

# Errors only
adb logcat *:E | grep "NAV_LOGGER"

# Navigation + package logs
adb logcat | grep -E "(NAV_LOGGER|com.rork.homecookedplate)"
```

## Log Format

Navigation logs are formatted with the `[NAV_LOGGER]` tag and include:

- **Level**: `[DEBUG]`, `[INFO]`, `[WARN]`, `[ERROR]`
- **Event**: Event type (e.g., `ROUTE_CHANGE`, `REDIRECT`, `NAV_ERROR`)
- **Location**: File and function where the log originated
- **Message**: Human-readable description
- **Route**: Current route (if applicable)
- **Previous Route**: Previous route (for route changes)
- **Data**: Additional context data
- **Timestamp**: ISO timestamp

### Example Log Output

```
[NAV_LOGGER] [INFO] [ROUTE_CHANGE] [app/index.tsx:REDIRECT_CHECK] Navigating to /(tabs)/dashboard → Route: /(tabs)/dashboard ← From: index 📊 Data: {"userRole":"platemaker"} [2026-01-22T14:30:45.123Z]
```

## Navigation Events

The navigation logger tracks the following events:

### Initialization Events
- `NAV_INIT` - Navigation system initializing
- `CONTAINER_READY` - NavigationContainer ready
- `STACK_CONFIG` - Stack configuration complete

### Route Events
- `ROUTE_CHANGE` - Route changed
- `REDIRECT` - Redirect occurred
- `STATE_CHANGE` - Navigation state changed

### Auth Events
- `AUTH_DECISION` - Auth-based navigation decision

### Error Events
- `NAV_ERROR` - Navigation error occurred
- `NAV_WARN` - Navigation warning

## Using Logs in Cursor

1. **Start the logcat stream** in a terminal:
   ```bash
   adb logcat | grep "NAV_LOGGER"
   ```

2. **Reproduce the navigation issue** in your app

3. **Highlight the relevant log lines** in the terminal

4. **Press `Cmd + L` (Mac) or `Ctrl + L` (Windows/Linux)**

5. **Ask Cursor**: "Based on these logs, why is [your issue] happening?"

## Common Debugging Scenarios

### Issue: App crashes on navigation

```bash
# Check for navigation errors
adb logcat *:E | grep "NAV_LOGGER"
```

Look for:
- `NAV_ERROR` events
- `CONTAINER_READY` failures
- Route change errors

### Issue: Wrong route after login

```bash
# Track redirect flow
adb logcat | grep -E "(NAV_LOGGER|REDIRECT|AUTH_DECISION)"
```

Look for:
- `REDIRECT` events
- `AUTH_DECISION` events
- Route change sequence

### Issue: Navigation not working

```bash
# Check initialization
adb logcat | grep -E "(NAV_INIT|CONTAINER_READY|STACK_CONFIG)"
```

Look for:
- `NAV_INIT` completion
- `CONTAINER_READY` on your platform
- `STACK_CONFIG` completion

## Filtering Tips

### Combine Filters

```bash
# Navigation errors from specific file
adb logcat *:E | grep "NAV_LOGGER" | grep "app/index.tsx"

# Route changes only
adb logcat | grep "ROUTE_CHANGE"

# Auth decisions
adb logcat | grep "AUTH_DECISION"
```

### Save Logs to File

```bash
# Save all navigation logs
adb logcat | grep "NAV_LOGGER" > nav-debug.log

# Save errors only
adb logcat *:E | grep "NAV_LOGGER" > nav-errors.log
```

## Integration with Code

The navigation logger is automatically integrated into:

- `app/_layout.tsx` - Root layout and navigation container
- `app/index.tsx` - Initial routing and redirects
- Navigation state changes via Expo Router hooks

### Adding Custom Logs

```typescript
import { navLogger } from '@/lib/nav-logger';

// Log a route change
navLogger.routeChange(
  'app/my-screen.tsx',
  '/my-route',
  '/previous-route',
  { customData: 'value' }
);

// Log an error
navLogger.error(
  'app/my-screen.tsx',
  error,
  '/my-route',
  { context: 'additional info' }
);
```

## Troubleshooting

### No logs appearing

1. **Check ADB connection**:
   ```bash
   adb devices
   ```

2. **Verify app is running** on the emulator/device

3. **Check logcat buffer**:
   ```bash
   adb logcat -c  # Clear buffer
   ```

4. **Verify tag is correct**:
   ```bash
   adb logcat | grep "NAV_LOGGER"  # Should show logs
   ```

### Too many logs

Use more specific filters:

```bash
# Only errors
adb logcat *:E | grep "NAV_LOGGER"

# Specific event
adb logcat | grep "ROUTE_CHANGE"

# Specific file
adb logcat | grep "app/index.tsx"
```

## Related Documentation

- [RORK_INSTRUCTIONS.md](../RORK_INSTRUCTIONS.md) - Navigation architecture rules
- [ANDROID_EMULATOR_TESTING.md](./ANDROID_EMULATOR_TESTING.md) - Emulator setup
