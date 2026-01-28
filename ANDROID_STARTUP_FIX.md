# Android App Not Opening - Root Cause & Fix

## Problem
The Android app won't open because **Metro bundler is not running**. The app needs Metro to serve the JavaScript bundle.

## Error from Android Logs
```
Unable to load script.
Make sure you're running Metro or that your bundle 'index.android.bundle' is packaged correctly for release.
Couldn't connect to "ws://10.0.2.2:8081/message"
```

## Solution

### Step 1: Start Metro Bundler
```bash
bun run start
```

Or:
```bash
expo start
```

### Step 2: Verify Connection
After Metro starts, you should see:
- QR code in terminal
- Options to press `a` for Android
- Metro bundler running on port 8081

### Step 3: Verify ADB Port Forwarding
The connection checker shows port forwarding is already set up:
```
✅ Port 8081 is forwarded
Forwarding: host-17 tcp:8081 tcp:8081
```

### Step 4: Reload the App
Once Metro is running:
- Shake the Android device/emulator
- Select "Reload" from the developer menu
- Or press `r` in the Metro terminal

## Quick Start Script

Create a script to start everything:

```bash
#!/bin/bash
# Start Metro and verify Android connection
bun run start &
sleep 5
./scripts/check-metro-connection.sh
```

## Troubleshooting

### If Metro Won't Start
```bash
# Clear Metro cache
bunx expo start --clear

# Or reset everything
rm -rf node_modules
bun install
bun run start
```

### If Port Forwarding Fails
```bash
# Reset ADB
adb kill-server
adb start-server
adb reverse tcp:8081 tcp:8081
```

### If App Still Won't Load
1. Check Metro is running: `lsof -i :8081`
2. Check ADB connection: `adb devices`
3. Check port forwarding: `adb reverse --list`
4. View Android logs: `adb logcat | grep -E "(ReactNative|Expo|Error)"`

## Expected Behavior

Once Metro is running:
1. App should connect to Metro automatically
2. You'll see Metro logs in terminal showing bundle requests
3. App should load and show the login screen or dashboard
4. You'll see `[NAV_LOGGER]` and `[INDEX_GATE]` logs in logcat

## Next Steps After Metro Starts

1. Monitor logs: `./scripts/nav-debug-logcat.sh all`
2. Use DevTools: Open `http://localhost:8081/debugger-frontend/`
3. Check for any rendering issues once the app loads
