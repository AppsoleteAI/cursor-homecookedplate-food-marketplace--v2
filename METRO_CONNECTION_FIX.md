# Metro Bundler Connection Fix Guide

## Problem Identified
The mobile app JavaScript bundle is not loading, preventing the app from rendering. This is a Metro bundler connectivity issue, not a navigation logic issue.

## Evidence from Debug Logs
- ✅ Backend server is running on port 3000
- ❌ No mobile app logs found (JavaScript bundle not executing)
- ❌ App cannot connect to Metro bundler

## Fix Steps

### Step 1: Verify Metro Bundler is Running
1. Check if Metro is running:
   ```bash
   lsof -i :8081
   ```
   If nothing is running on port 8081, Metro is not started.

2. Start Metro bundler:
   ```bash
   bun run start
   ```
   You should see:
   - QR code displayed
   - "Metro waiting on exp://..." message
   - Port 8081 should be in use

### Step 2: Set Up ADB Port Forwarding (Android Emulator)
The Android emulator cannot access `localhost:8081` directly. You need to forward the port:

```bash
# Forward Metro bundler port
adb reverse tcp:8081 tcp:8081

# Verify the forwarding is active
adb reverse --list
```

You should see:
```
8081 tcp:8081
```

### Step 3: Verify Backend Server is Running
The backend server should be running on port 3000:

```bash
# In a separate terminal
bun run dev:server
```

You should see:
```
🚀 [time] V4 Server Live on Port 3000
✅ Server is running on http://0.0.0.0:3000
```

### Step 4: Clear Metro Cache (if issues persist)
If Metro was previously running with errors, clear the cache:

```bash
bunx expo start --clear
```

### Step 5: Verify Connection in Android Emulator
1. Open the app in the Android emulator
2. Check the Metro bundler terminal - you should see connection logs
3. The app should load the JavaScript bundle

## Troubleshooting

### If Metro shows "Unable to load script"
- Verify ADB port forwarding: `adb reverse --list`
- Check if port 8081 is accessible: `curl http://localhost:8081/status`
- Restart Metro: Stop with `Ctrl+C`, then `bun run start --clear`

### If app shows white screen
- Check Metro bundler terminal for errors
- Verify backend server is running on port 3000
- Check Android emulator logs: `adb logcat | grep -i "metro\|expo"`

### If tunnel mode isn't working
The `--tunnel` flag should help, but if it's not working:
1. Try without tunnel: `bunx expo start`
2. Use LAN connection instead
3. Check firewall settings

## Verification
Once fixed, you should see debug logs from:
- `app/index.tsx:RENDER`
- `app/_layout.tsx:NAV_GUARD_EFFECT`
- `lib/trpc.ts:TRPC_CLIENT_INIT`
- `hooks/auth-context.tsx:LOAD_USER_START`

These logs confirm the JavaScript bundle is loading and executing.
