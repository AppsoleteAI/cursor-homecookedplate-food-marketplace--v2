# Dependency Management Guide

## Package Manager

This project uses **npm** for installs. `package-lock.json` is the only lockfile.

### Installs

npm is the installer for this repo, for EAS, and for `npm ci`. `dev:server` still launches the local API with the Bun runtime. That script does not keep a second lockfile.

### Usage

```bash
# Install all dependencies
npm install

# Add an Expo or React Native package
npx expo install <package-name>

# Run scripts
npm run <script-name>
```

### Lock Files

- **`package-lock.json`** is the lockfile for npm, EAS, and `npm ci`.
- Do not add `bun.lock`. Two lockfiles fail `expo-doctor`.

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
npx expo install <package-name>
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

1. Run `npm install` to ensure all dependencies are installed
2. Clear Metro cache: `npm run start -- --clear`
3. Clear Expo cache: `expo start -c`

### Version conflicts

1. Check `package-lock.json` for resolved versions
2. Ensure no duplicate dependencies in `backend/package.json`
3. Verify React Native and Expo versions are compatible

### Backend dependency issues

If backend code can't find a dependency:
1. Check if it's in root `package.json`
2. If it's backend-specific, add to `backend/package.json`
3. Ensure the dependency is compatible with Bun runtime
