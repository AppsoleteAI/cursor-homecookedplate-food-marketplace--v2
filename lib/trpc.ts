import { createTRPCReact } from "@trpc/react-query";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import { supabase } from "./supabase";

export const trpc = createTRPCReact<AppRouter>();

/**
 * Resolve the base URL for the tRPC backend.
 *
 * - Prefer `EXPO_PUBLIC_API_URL` from your `.env` if defined.
 * - In development (`__DEV__ === true`) and no env value is set, fall back to a LAN IP
 *   so the iOS/Android emulator or physical device can reach your dev server.
 * - In production with no env value, use the public API domain.
 */
const getBaseUrl = () => {
  // Primary source: Expo public env var, e.g. EXPO_PUBLIC_API_URL=http://192.168.1.50:3000
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    console.log("[tRPC] Using API URL from EXPO_PUBLIC_API_URL:", envUrl);
    return envUrl;
  }

  if (__DEV__) {
    const url = "http://192.168.0.123:3000"; // Fallback for local dev if env not set
    console.log("[tRPC] Using DEV fallback backend URL:", url);
    return url;
  }

  const url = "https://api.homecookedplate.com";
  console.log("[tRPC] Using PROD fallback backend URL:", url);
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
