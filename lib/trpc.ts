import { createTRPCReact } from "@trpc/react-query";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { Platform } from "react-native";
import * as Device from "expo-device";
import Constants from 'expo-constants';
import { supabase } from "./supabase";

export const trpc = createTRPCReact<AppRouter>();

/**
 * Get API base URL from environment variable with fallback to production.
 * Uses EXPO_PUBLIC_RORK_API_BASE_URL if set, otherwise falls back to production URL.
 */
const getBaseUrl = () => {
  // Check for environment variable first
  const envUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  
  // Fallback to production URL if env var not set
  const baseUrl = envUrl || 'https://plate-marketplace-api.appsolete.workers.dev';
  
  if (__DEV__) {
    console.log("[tRPC] Development mode - Using backend:", baseUrl, envUrl ? "(from env)" : "(fallback)");
    return baseUrl;
  }

  console.log("[tRPC] Production build - Using Cloudflare Worker:", baseUrl, envUrl ? "(from env)" : "(fallback)");
  return baseUrl;
};

const baseUrl = getBaseUrl();
// CRITICAL: URL must match backend route configuration
// If backend mounts like this: app.use('/api/trpc/*', trpcServer({ ... }))
// Then frontend URL MUST be: 'https://...workers.dev/api/trpc' (NO trailing slash)
// Define it once with trailing slash handling
export const trpcUrl = baseUrl.endsWith('/') 
  ? `${baseUrl}api/trpc` 
  : `${baseUrl}/api/trpc`;
// Log the URL being used - this helps debug connection issues
if (typeof window !== 'undefined') {
  console.log('[tRPC] 🌐 Client initialized with URL:', trpcUrl, {
    platform: Platform.OS,
    isDev: __DEV__,
    currentUrl: window.location.href,
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    isTunnel: window.location.hostname.includes('.exp.direct') || window.location.hostname.includes('.expo.dev'),
  });
} else {
  console.log('[tRPC] Client initialized with URL:', trpcUrl, {
    platform: Platform.OS,
    isDev: __DEV__,
  });
}
// #region agent log - HYPOTHESIS C, D: tRPC client initialization
fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/trpc.ts:TRPC_CLIENT_INIT',message:'tRPC client initializing',data:{trpcUrl,platform:Platform.OS,isDev:__DEV__},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'C,D'})}).catch(()=>{});
// #endregion

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      // httpLink automatically adds /trpc, so set to /api to get /api/trpc
      url: trpcUrl,
      transformer: superjson,
      async headers() {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        // #region agent log - HYPOTHESIS D: tRPC request headers
        fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/trpc.ts:TRPC_HEADERS',message:'tRPC request headers prepared',data:{hasToken:!!token},timestamp:Date.now(),sessionId:'debug-session',runId:'nav-debug',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        return {
          'Content-Type': 'application/json',
          'x-trpc-source': 'expo-web', // Required for CORS validation
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        };
      },
      fetch: async (url, options) => {
        // Runtime check: If on HTTPS tunnel but URL is HTTP, force production backend
        // Convert URL to string for processing
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : String(url);
        let finalUrl: string | URL | Request = url;
        
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const hostname = window.location.hostname;
          const protocol = window.location.protocol;
          const isTunnel = hostname.includes('.exp.direct') || 
                          hostname.includes('.expo.dev') ||
                          protocol === 'https:';
          
          if (isTunnel && urlString.startsWith('http://')) {
            try {
              // Extract the path from the original URL (e.g., /api/trpc/auth.signup)
              // httpLink adds /trpc, so the path will be /api/trpc/auth.signup
              const urlObj = new URL(urlString);
              const path = urlObj.pathname + urlObj.search;
              // Build new URL with configured backend - ensure no double slash
              const configuredBase = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://plate-marketplace-api.appsolete.workers.dev';
              finalUrl = configuredBase.endsWith('/') && path.startsWith('/')
                ? `${configuredBase}${path.slice(1)}`
                : `${configuredBase}${path}`;
              console.warn('[tRPC] ⚠️ Runtime fix: Replacing HTTP URL with HTTPS backend');
              console.warn('[tRPC] Original URL:', urlString);
              console.warn('[tRPC] Fixed URL:', finalUrl);
              console.warn('[tRPC] Context:', { hostname, protocol, isTunnel });
            } catch (urlError) {
              // If URL parsing fails, try simple string replacement as fallback
              // Preserve the full path including /api/trpc
              console.warn('[tRPC] URL parsing failed, using string replacement:', urlError);
              const configuredBase = process.env.EXPO_PUBLIC_RORK_API_BASE_URL || 'https://plate-marketplace-api.appsolete.workers.dev';
              finalUrl = urlString.replace(/^http:\/\/[^/]+/, configuredBase);
              console.warn('[tRPC] Fallback fixed URL:', finalUrl);
            }
          }
        }
        
        console.log('[tRPC] Making request to:', finalUrl, 'Method:', options?.method);
        try {
          const response = await fetch(finalUrl, {
            ...options,
            credentials: 'include',
            mode: 'cors', // Explicitly set CORS mode
          });
          console.log('[tRPC] Response status:', response.status, response.statusText);
          if (!response.ok) {
            // Clone the response before reading the body to avoid "Body stream already read" error
            const clonedResponse = response.clone();
            const text = await clonedResponse.text();
            console.error('[tRPC] Request failed:', response.status, response.statusText, 'Body:', text.substring(0, 200));
          }
          return response;
        } catch (error) {
          console.error('[tRPC] Fetch error:', error);
          console.error('[tRPC] Error details:', {
            message: error instanceof Error ? error.message : String(error),
            name: error instanceof Error ? error.name : 'Unknown',
            stack: error instanceof Error ? error.stack : undefined,
            originalUrl: urlString,
            finalUrl: typeof finalUrl === 'string' ? finalUrl : String(finalUrl),
            ...(typeof window !== 'undefined' ? {
              currentUrl: window.location.href,
              hostname: window.location.hostname,
              protocol: window.location.protocol,
            } : {}),
          });
          // Re-throw with more context
          const finalUrlString = typeof finalUrl === 'string' ? finalUrl : String(finalUrl);
          throw new Error(`Failed to fetch from ${finalUrlString}: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
    }),
  ],
});

export const trpcProxyClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpLink({
      // Use trpcUrl for consistency - ensures this matches your Hono route
      url: trpcUrl,
      transformer: superjson,
      async headers() {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        return {
          'Content-Type': 'application/json',
          'x-trpc-source': 'expo-web', // Required for CORS validation
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        };
      },
    }),
  ],
});
