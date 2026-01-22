#!/bin/bash

# Metro Bundler Connection Diagnostic Script
# This script checks if Metro bundler is accessible and properly configured

echo "=== Metro Bundler Connection Diagnostic ==="
echo ""

# Check if Metro is running on port 8081
echo "1. Checking if Metro bundler is running on port 8081..."
if lsof -i :8081 > /dev/null 2>&1; then
    echo "   ✅ Metro bundler is running on port 8081"
    lsof -i :8081 | head -2
else
    echo "   ❌ Metro bundler is NOT running on port 8081"
    echo "   → Start Metro with: bun run start"
fi
echo ""

# Check Metro status endpoint
echo "2. Checking Metro bundler status endpoint..."
if curl -s http://localhost:8081/status > /dev/null 2>&1; then
    echo "   ✅ Metro status endpoint is accessible"
    STATUS=$(curl -s http://localhost:8081/status)
    echo "   Status: $STATUS"
else
    echo "   ❌ Metro status endpoint is NOT accessible"
    echo "   → Metro may not be running or port forwarding is not set up"
fi
echo ""

# Check ADB port forwarding (Android)
echo "3. Checking ADB port forwarding for Android emulator..."
if command -v adb > /dev/null 2>&1; then
    ADB_DEVICES=$(adb devices | grep -v "List" | grep "device" | wc -l | tr -d ' ')
    if [ "$ADB_DEVICES" -gt 0 ]; then
        echo "   ✅ Android device/emulator detected ($ADB_DEVICES device(s))"
        REVERSE_LIST=$(adb reverse --list 2>/dev/null)
        if echo "$REVERSE_LIST" | grep -q "8081"; then
            echo "   ✅ Port 8081 is forwarded"
            echo "   Forwarding: $REVERSE_LIST"
        else
            echo "   ❌ Port 8081 is NOT forwarded"
            echo "   → Run: adb reverse tcp:8081 tcp:8081"
        fi
    else
        echo "   ⚠️  No Android devices detected"
        echo "   → Make sure Android emulator is running"
    fi
else
    echo "   ⚠️  ADB command not found (Android SDK not in PATH)"
fi
echo ""

# Check backend server
echo "4. Checking backend server on port 3000..."
if lsof -i :3000 > /dev/null 2>&1; then
    echo "   ✅ Backend server is running on port 3000"
    lsof -i :3000 | head -2
else
    echo "   ❌ Backend server is NOT running on port 3000"
    echo "   → Start backend with: bun run dev:server"
fi
echo ""

# Check if backend is accessible
echo "5. Checking backend server accessibility..."
if curl -s http://localhost:3000/api/trpc > /dev/null 2>&1; then
    echo "   ✅ Backend tRPC endpoint is accessible"
else
    echo "   ⚠️  Backend tRPC endpoint may not be accessible"
    echo "   → Check if server is running and listening on 0.0.0.0"
fi
echo ""

# Summary
echo "=== Summary ==="
if lsof -i :8081 > /dev/null 2>&1 && curl -s http://localhost:8081/status > /dev/null 2>&1; then
    echo "✅ Metro bundler appears to be running and accessible"
else
    echo "❌ Metro bundler connectivity issues detected"
    echo ""
    echo "Next steps:"
    echo "1. Start Metro: bun run start"
    echo "2. For Android: adb reverse tcp:8081 tcp:8081"
    echo "3. Verify Metro shows QR code and connection options"
fi
