import { createTRPCReact } from "@trpc/react-query";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { Platform } from "react-native";
import { supabase } from "./supabase";

export const trpc = createTRPCReact<AppRouter>();

/**
 * Resolve the base URL for the tRPC backend.
 *
 * CRITICAL: The platform environment variable `EXPO_PUBLIC_RORK_API_BASE_URL` is system-managed
 * and often points to a legacy endpoint (`api.rivet.dev`). DO NOT use or rely on this variable.
 *
 * - Prefer `EXPO_PUBLIC_API_URL` from your `.env` if defined (for development/local overrides).
 * - In development (`__DEV__ === true`), automatically detect platform:
 *   - Android emulator: `http://10.0.2.2:3000` (bridge IP to host localhost)
 *   - iOS Simulator: `http://localhost:3000` (shares host network)
 *   - Web browser: `http://localhost:3000` (runs on host)
 *   - Physical devices: Falls back to `EXPO_PUBLIC_API_URL` or LAN IP
 * - In production, ALWAYS use the hardcoded Cloudflare Workers URL.
 */
const getBaseUrl = () => {
  // Development: Allow local override via EXPO_PUBLIC_API_URL
  // NOTE: EXPO_PUBLIC_RORK_API_BASE_URL is intentionally ignored (system-managed legacy endpoint)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    console.log("[tRPC] Using API URL from EXPO_PUBLIC_API_URL:", envUrl);
    return envUrl;
  }

  if (__DEV__) {
    // Platform-specific URLs for development
    if (Platform.OS === 'android') {
      // Android emulator uses special bridge IP to access host localhost
      const url = "http://10.0.2.2:3000";
      console.log("[tRPC] Using Android emulator bridge URL:", url);
      return url;
    } else if (Platform.OS === 'ios') {
      // iOS Simulator shares host network, can use localhost
      const url = "http://localhost:3000";
      console.log("[tRPC] Using iOS Simulator localhost URL:", url);
      return url;
    } else if (Platform.OS === 'web') {
      // Web browser runs on host, can use localhost
      const url = "http://localhost:3000";
      console.log("[tRPC] Using web localhost URL:", url);
      return url;
    }
    
    // Fallback for physical devices or unknown platforms
    // Physical devices need Mac's LAN IP (should set EXPO_PUBLIC_API_URL)
    const url = "http://192.168.0.123:3000";
    console.warn("[tRPC] Using DEV fallback URL (set EXPO_PUBLIC_API_URL for physical devices):", url);
    return url;
  }

  // Production: Hardcoded Cloudflare Workers URL (DO NOT CHANGE)
  // This bypasses system-managed routing that points to legacy endpoints
  const url = "https://platetaker-api.appsolete.workers.dev";
  console.log("[tRPC] Using PROD backend URL (hardcoded):", url);
  return url;
};

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      async headers() {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

export const trpcProxyClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpLink({
      url: `${getBaseUrl()}/api/trpc`,
      transformer: superjson,
      async headers() {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        return token ? { authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});
