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
    // #region agent log - HYPOTHESIS D: Using env URL
    fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/trpc.ts:GET_BASE_URL',message:'Using API URL from env',data:{url:envUrl,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    return envUrl;
  }

  if (__DEV__) {
    // Platform-specific URLs for development
    if (Platform.OS === 'android') {
      // Android emulator uses special bridge IP to access host localhost
      const url = "http://10.0.2.2:3000";
      console.log("[tRPC] Using Android emulator bridge URL:", url);
      // #region agent log - HYPOTHESIS D: Android URL selected
      fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/trpc.ts:GET_BASE_URL_ANDROID',message:'Using Android emulator bridge URL',data:{url,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return url;
    } else if (Platform.OS === 'ios') {
      // iOS Simulator shares host network, can use localhost
      const url = "http://localhost:3000";
      console.log("[tRPC] Using iOS Simulator localhost URL:", url);
      // #region agent log - HYPOTHESIS D: iOS URL selected
      fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/trpc.ts:GET_BASE_URL_IOS',message:'Using iOS Simulator localhost URL',data:{url,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return url;
    } else if (Platform.OS === 'web') {
      // Web browser runs on host, can use localhost
      const url = "http://localhost:3000";
      console.log("[tRPC] Using web localhost URL:", url);
      // #region agent log - HYPOTHESIS D: Web URL selected
      fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/trpc.ts:GET_BASE_URL_WEB',message:'Using web localhost URL',data:{url,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return url;
    }
    
    // Fallback for physical devices or unknown platforms
    // Physical devices need Mac's LAN IP (should set EXPO_PUBLIC_API_URL)
    const url = "http://192.168.0.123:3000";
    console.warn("[tRPC] Using DEV fallback URL (set EXPO_PUBLIC_API_URL for physical devices):", url);
    // #region agent log - HYPOTHESIS D: Fallback URL selected
    fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/trpc.ts:GET_BASE_URL_FALLBACK',message:'Using fallback URL',data:{url,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    return url;
  }

  // Production: Hardcoded Cloudflare Workers URL (DO NOT CHANGE)
  // This bypasses system-managed routing that points to legacy endpoints
  const url = "https://platetaker-api.appsolete.workers.dev";
  console.log("[tRPC] Using PROD backend URL (hardcoded):", url);
  // #region agent log - HYPOTHESIS D: Production URL selected
  fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/trpc.ts:GET_BASE_URL_PROD',message:'Using production URL',data:{url,platform:Platform.OS},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  return url;
};

const baseUrl = getBaseUrl();
const trpcUrl = `${baseUrl}/api/trpc`;
// #region agent log - HYPOTHESIS C, D: tRPC client initialization
fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/trpc.ts:TRPC_CLIENT_INIT',message:'tRPC client initializing',data:{baseUrl,trpcUrl,platform:Platform.OS,isDev:__DEV__},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'C,D'})}).catch(()=>{});
// #endregion

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: trpcUrl,
      transformer: superjson,
      async headers() {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        // #region agent log - HYPOTHESIS D: tRPC request headers
        fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/trpc.ts:TRPC_HEADERS',message:'tRPC request headers prepared',data:{hasToken:!!token,url:trpcUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
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
