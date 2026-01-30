# Dependency Management Guide

## Package Manager

This project uses **Bun** as the primary package manager.

### Why Bun?

- Faster installs and script execution
- Built-in TypeScript support
- Better compatibility with the Expo/React Native ecosystem
- Native support for the project's backend (Bun runtime)

### Usage

```bash
# Install all dependencies
bun install
# or
bun i

# Add a new dependency
bun add <package-name>

# Add a dev dependency
bun add -d <package-name>

# Remove a dependency
bun remove <package-name>

# Run scripts
bun run <script-name>
```

### Lock Files

- **`bun.lock`** - Primary lock file managed by Bun (DO NOT DELETE)
- **`package-lock.json`** - May be present for compatibility but should not be manually edited

If you need to use npm instead of Bun, you can, but Bun is recommended for consistency.

## Project Structure

### Root Dependencies (`package.json`)

Contains all frontend and shared dependencies:
- React Native and Expo packages
- UI libraries
- State management (Zustand, React Query)
- TypeScript and build tools
- Backend framework (Hono, tRPC) - shared between frontend and backend

### Backend Dependencies (`backend/package.json`)

The backend directory has its own `package.json` but currently has no dependencies. Backend code shares dependencies from the root `package.json` since it runs in the same monorepo structure.

**Important**: The backend should NOT include React Native or Expo dependencies. These are frontend-only and will cause conflicts.

## Dependency Conflicts Resolved

The following conflicts have been resolved:

1. ✅ **expo-av removed** - Deprecated package replaced by `expo-audio` and `expo-video`
2. ✅ **@hono/node-server removed** - Unused, backend uses `Bun.serve()` instead
3. ✅ **Frontend deps removed from backend** - `expo-device`, `react-native-linear-gradient`, `react-native-reanimated` removed from `backend/package.json`
4. ✅ **react-native-reanimated standardized** - Single version in root `package.json` only

## Adding New Dependencies

### Frontend Dependencies

Add to root `package.json`:
```bash
bun add <package-name>
```

### Backend-Only Dependencies

If a dependency is truly backend-only and shouldn't be bundled with the frontend, you can add it to `backend/package.json`, but most dependencies should go in the root since the backend code is part of the same project.

### Native Modules

For native modules (especially Expo packages), ensure they:
1. Have proper `.web.ts` shims for web compatibility
2. Are registered in `app.json` plugins if required
3. Follow Expo's compatibility guidelines

## Version Management

- Use exact versions (`~` or `^`) as specified in existing dependencies
- When updating, test thoroughly, especially for:
  - React Native core packages
  - Expo SDK packages
  - Navigation libraries
  - State management libraries

## Troubleshooting

### "Module not found" errors

1. Run `bun install` to ensure all dependencies are installed
2. Clear Metro cache: `bun run start -- --clear`
3. Clear Expo cache: `expo start -c`

### Version conflicts

1. Check `bun.lock` for resolved versions
2. Ensure no duplicate dependencies in `backend/package.json`
3. Verify React Native and Expo versions are compatible

### Backend dependency issues

If backend code can't find a dependency:
1. Check if it's in root `package.json`
2. If it's backend-specific, add to `backend/package.json`
3. Ensure the dependency is compatible with Bun runtime
