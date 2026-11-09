import { createTRPCReact } from "@trpc/react-query";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { Platform } from "react-native";
import { readAccessToken } from "./access-token";
import { supabase } from "./supabase";
import { replacementForPlainBody } from "./worker-capacity";

export const trpc = createTRPCReact<AppRouter>();

function busyTrpcResponse(status: number, body: string): Response | null {
  const json = replacementForPlainBody(status, body);
  if (!json) return null;
  return new Response(json, {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Hardcoded site host. Do not read EXPO_PUBLIC_RORK_API_BASE_URL;
// that variable is system-managed and often points at the legacy api.rivet.dev host.
// Checked 8 November 2026: meals.list on this host and on the Pages host both returned the same menu.
const API_BASE_URL = 'https://homecookedplate.com';

const getBaseUrl = () => {
  if (__DEV__) {
    console.log("[tRPC] Development mode - Using backend:", API_BASE_URL);
    return API_BASE_URL;
  }

  console.log("[tRPC] Production build - Using Cloudflare Worker:", API_BASE_URL);
  return API_BASE_URL;
};

const baseUrl = getBaseUrl();
// CRITICAL: URL must match backend route configuration
// If backend mounts like this: app.use('/api/trpc/*', trpcServer({ ... }))
// Then frontend URL MUST be: 'https://homecookedplate.com/api/trpc' (NO trailing slash)
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

async function trpcHeaders() {
  const token = await readAccessToken(async () => {
    const session = await supabase.auth.getSession();
    return session.data.session?.access_token ?? null;
  });
  return {
    'Content-Type': 'application/json',
    'x-trpc-source': 'expo-web',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function workerFetch(url: RequestInfo | URL, options?: RequestInit): Promise<Response> {
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
              finalUrl = API_BASE_URL.endsWith('/') && path.startsWith('/')
                ? `${API_BASE_URL}${path.slice(1)}`
                : `${API_BASE_URL}${path}`;
              console.warn('[tRPC] ⚠️ Runtime fix: Replacing HTTP URL with HTTPS backend');
              console.warn('[tRPC] Original URL:', urlString);
              console.warn('[tRPC] Fixed URL:', finalUrl);
              console.warn('[tRPC] Context:', { hostname, protocol, isTunnel });
            } catch (urlError) {
              // If URL parsing fails, try simple string replacement as fallback
              // Preserve the full path including /api/trpc
              console.warn('[tRPC] URL parsing failed, using string replacement:', urlError);
              finalUrl = urlString.replace(/^http:\/\/[^/]+/, API_BASE_URL);
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
            const clonedResponse = response.clone();
            const text = await clonedResponse.text();
            console.error('[tRPC] Request failed:', response.status, response.statusText, 'Body:', text.substring(0, 200));
            const replacement = busyTrpcResponse(response.status, text);
            if (replacement) return replacement;
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
}

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: trpcUrl,
      transformer: superjson,
      headers: trpcHeaders,
      fetch: workerFetch,
    }),
  ],
});

export const trpcProxyClient = createTRPCProxyClient<AppRouter>({
  links: [
    httpLink({
      url: trpcUrl,
      transformer: superjson,
      headers: trpcHeaders,
      fetch: workerFetch,
    }),
  ],
});
