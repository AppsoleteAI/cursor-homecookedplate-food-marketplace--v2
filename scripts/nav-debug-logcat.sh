#!/bin/bash

# Navigation Debug Logcat Helper
# 
# This script provides convenient commands to filter Android logcat
# for navigation debugging logs from the HomeCookedPlate app.
#
# Usage:
#   ./scripts/nav-debug-logcat.sh [command]
#
# Commands:
#   all      - Show all navigation logs from buffer (default, exits automatically)
#   errors   - Show only navigation errors from buffer (exits automatically)
#   package  - Show navigation logs + package-specific logs from buffer (exits automatically)
#   live     - Show live navigation logs (continuous stream, use Ctrl+C to stop)
#   watch    - Watch navigation logs with 10-second timeout (exits automatically)
#   clear    - Clear logcat buffer and start fresh

PACKAGE_NAME="com.rork.homecookedplate"
LOG_TAG="NAV_LOGGER"
TIMEOUT_SECONDS=10

case "${1:-all}" in
  all)
    echo "📱 Showing all navigation logs from buffer (exits automatically)..."
    echo "Filter: $LOG_TAG"
    echo ""
    adb logcat -d | grep "$LOG_TAG" || echo "No navigation logs found."
    ;;
  
  errors)
    echo "❌ Showing navigation errors from buffer (exits automatically)..."
    echo "Filter: $LOG_TAG (ERROR level)"
    echo ""
    adb logcat -d *:E | grep "$LOG_TAG" || echo "No navigation errors found."
    ;;
  
  package)
    echo "📦 Showing navigation logs + package logs from buffer (exits automatically)..."
    echo "Filter: $LOG_TAG or $PACKAGE_NAME"
    echo ""
    adb logcat -d | grep -E "($LOG_TAG|$PACKAGE_NAME)" || echo "No matching logs found."
    ;;
  
  live)
    echo "📱 Showing live navigation logs (continuous stream)..."
    echo "Filter: $LOG_TAG"
    echo "Press Ctrl+C to stop"
    echo ""
    adb logcat | grep "$LOG_TAG"
    ;;
  
  watch)
    echo "👀 Watching navigation logs for ${TIMEOUT_SECONDS} seconds (exits automatically)..."
    echo "Filter: $LOG_TAG"
    echo ""
    timeout ${TIMEOUT_SECONDS} adb logcat | grep "$LOG_TAG" || {
      echo ""
      echo "⏱️  Timeout reached (${TIMEOUT_SECONDS}s). Showing buffer dump:"
      adb logcat -d | grep "$LOG_TAG" | tail -20 || echo "No navigation logs found."
    }
    ;;
  
  clear)
    echo "🧹 Clearing logcat buffer..."
    adb logcat -c
    echo "✅ Buffer cleared."
    echo ""
    echo "📱 Showing navigation logs from fresh buffer (exits automatically)..."
    sleep 2
    adb logcat -d | grep "$LOG_TAG" || echo "No navigation logs found yet."
    ;;
  
  *)
    echo "Usage: $0 [all|errors|package|live|watch|clear]"
    echo ""
    echo "Commands:"
    echo "  all      - Show all navigation logs from buffer (default, exits automatically)"
    echo "  errors   - Show only navigation errors from buffer (exits automatically)"
    echo "  package  - Show navigation logs + package-specific logs from buffer (exits automatically)"
    echo "  live     - Show live navigation logs (continuous stream, use Ctrl+C to stop)"
    echo "  watch    - Watch navigation logs with ${TIMEOUT_SECONDS}-second timeout (exits automatically)"
    echo "  clear    - Clear logcat buffer and show fresh logs (exits automatically)"
    exit 1
    ;;
esac
