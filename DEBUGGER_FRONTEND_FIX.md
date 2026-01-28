# Debugger Frontend Fix

## Issue
Error: `ENOENT: no such file or directory, stat '/Users/rsldj/Downloads/rork-homecookedplate---dynamic-gradient-food-marketplace--v1.1--main 2/node_modules/@react-native/debugger-frontend/dist/third-party/front_end/index.html'`

## Root Cause
The React Native debugger frontend package structure has changed. Metro bundler expects an `index.html` file at `/dist/third-party/front_end/index.html`, but the package only contains specific HTML files like `inspector.html`, `devtools_app.html`, etc.

## Solution

### Option 1: Create Symlink (Quick Fix)
```bash
cd node_modules/@react-native/debugger-frontend/dist/third-party/front_end
ln -sf inspector.html index.html
```

### Option 2: Use Correct DevTools URL
Instead of `http://localhost:8081/debugger-frontend/`, use:
- `http://localhost:8081/debugger-frontend/inspector.html` (for Inspector)
- `http://localhost:8081/debugger-frontend/devtools_app.html` (for DevTools App)

### Option 3: Reinstall Dependencies
```bash
# Using bun (recommended for this project)
bun install

# Or using npm with legacy peer deps
npm install --legacy-peer-deps
```

## Alternative: Use React Native DevTools via Device Menu

Instead of accessing via browser URL, use the device menu:

1. **Android**: Press `Cmd+M` (Mac) or `Ctrl+M` (Windows/Linux)
2. **iOS**: Press `Cmd+D` (Mac) or `Cmd+Ctrl+Z` (Mac)
3. Select "Open React Native DevTools" from the menu

This will automatically open DevTools in your browser with the correct URL.

## Verification

After applying the fix, verify:
```bash
# Check if index.html exists
ls -la node_modules/@react-native/debugger-frontend/dist/third-party/front_end/index.html

# Or check all HTML files
ls node_modules/@react-native/debugger-frontend/dist/third-party/front_end/*.html
```

## Notes

- This is a known issue with React Native 0.81.5 and Expo 54
- The symlink approach is a temporary workaround
- Future updates to React Native may fix this issue
- The device menu method is the most reliable way to access DevTools
