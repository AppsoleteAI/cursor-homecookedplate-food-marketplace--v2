#!/bin/bash
# Script to check and kill process on port 3000

PORT=${1:-3000}

echo "🔍 Checking port $PORT..."

# Check if port is in use
PID=$(lsof -ti:$PORT 2>/dev/null)

if [ -z "$PID" ]; then
  echo "✅ Port $PORT is free"
  exit 0
else
  echo "⚠️  Port $PORT is in use by process $PID"
  echo "📋 Process details:"
  ps -p $PID -o pid,comm,args 2>/dev/null || echo "   (Process may have ended)"
  
  read -p "🔪 Kill process $PID? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    kill -9 $PID 2>/dev/null
    sleep 1
    if lsof -ti:$PORT >/dev/null 2>&1; then
      echo "❌ Failed to kill process on port $PORT"
      exit 1
    else
      echo "✅ Process killed. Port $PORT is now free"
      exit 0
    fi
  else
    echo "⏭️  Skipped killing process"
    exit 1
  fi
fi
