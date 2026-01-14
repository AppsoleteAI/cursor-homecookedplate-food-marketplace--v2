# STABILITY TRIANGLE & BUILD PROTECTION RULES
I am currently in an active iteration phase on a successful Android build. 
To avoid breaking the native binary or the navigation tree, YOU MUST follow these constraints:

1. **NO NAVIGATION REFACTORS**: 
   - Never attempt to "simplify" or "refactor" the directory structure of the `app/` folder.
   - The logic in `app/index.tsx` is LOCKED to prevent the navigation tree boot-loop crash.
   - If a new screen is added, only suggest the specific `<Stack.Screen />` or route entry; do not rewrite the entire `_layout.tsx` file.

2. **GUARD THE PACKAGE IDENTITY**: 
   - Do NOT modify the `android.package` name in `app.json`. It must remain `com.rork.homecookedplate`.
   - Do NOT modify the `bundleIdentifier` or `version` strings unless explicitly asked. 
   - Changing these will invalidate the current 56-minute build and force a full native re-compile.

3. **ENVIRONMENT AWARENESS**:
   - For all network requests (tRPC/API), assume the Android Emulator is being used. 
   - Always reference the Mac's Local IP (e.g., 192.168.x.x) from the `.env` file instead of `localhost` to avoid "Unexpected Character: H" (HTML 404) errors.

4. **SAFE MODULE USAGE**:
   - When adding features involving Stripe, Sentry, or Camera, always wrap the initialization in `try/catch` blocks to prevent native module "undefined" crashes on the emulator.# prompt-guardrails

