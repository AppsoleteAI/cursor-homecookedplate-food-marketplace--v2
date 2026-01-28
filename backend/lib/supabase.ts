import { createClient } from '@supabase/supabase-js';

// Check if we're in a Cloudflare Worker environment (process is not defined)
const isCloudflareWorker = typeof process === 'undefined';

// Helper to get env vars - works in both Bun/Node and Cloudflare Workers
function getEnvVar(key: string, fallback?: string): string | undefined {
  if (isCloudflareWorker) {
    // In Cloudflare Workers, env vars come from bindings, not process.env
    // Return undefined here - callers should pass env from context
    return fallback;
  }
  return (process.env as any)[key] || fallback;
}

// Read environment variables - Bun will auto-load from .env file
// In Cloudflare Workers, these will be undefined and clients must be created via factory functions
const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseAnonKey = getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const supabaseServiceKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');

// Only validate and create clients at module load time if we're NOT in a Cloudflare Worker
// In Workers, clients will be created on-demand with env from bindings
let supabase: ReturnType<typeof createClient> | null = null;
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

if (!isCloudflareWorker) {
  // Validate all required environment variables are present (Bun/Node only)
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    throw new Error('❌ Missing Supabase environment variables in backend/.env. Required: SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
  }

  /**
   * CLIENT 1: Standard Anon Client
   * Use this for: Login, fetching public data, and operations 
   * that should respect Row Level Security (RLS).
   * 
   * This client uses the anon key, which respects RLS policies.
   * Used by: Login route (via createServerSupabaseClient), public queries
   */
  supabase = createClient(supabaseUrl, supabaseAnonKey);

  /**
   * CLIENT 2: Admin Client (God Mode)
   * Use this for: Signup (admin.createUser), deleting users, 
   * or bypassing RLS during server-side logic.
   * 
   * This client uses the service role key, which bypasses RLS.
   * Used by: Signup route, webhooks, account recovery
   */
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Export clients (null in Workers, actual clients in Bun/Node)
// For Workers, use the factory functions below instead
export { supabase, supabaseAdmin };

/**
 * Factory function to create Supabase admin client with env from Cloudflare Workers bindings
 * Use this in Cloudflare Workers when you have access to c.env
 */
export function createSupabaseAdmin(env: { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string }) {
  const url = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !serviceKey) {
    throw new Error('❌ Missing Supabase environment variables. Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  }
  
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Factory function to create Supabase client with env from Cloudflare Workers bindings
 * Use this in Cloudflare Workers when you have access to c.env
 */
export function createSupabase(env: { SUPABASE_URL?: string; EXPO_PUBLIC_SUPABASE_ANON_KEY?: string }) {
  const url = env.SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !anonKey) {
    throw new Error('❌ Missing Supabase environment variables. Required: SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
  
  return createClient(url, anonKey);
}

// Keep createServerSupabaseClient for user-scoped operations with RLS
export function createServerSupabaseClient(accessToken?: string, env?: { SUPABASE_URL?: string; EXPO_PUBLIC_SUPABASE_ANON_KEY?: string }) {
  const anonKey = env?.EXPO_PUBLIC_SUPABASE_ANON_KEY || getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY') || supabaseAnonKey || '';
  const url = env?.SUPABASE_URL || getEnvVar('SUPABASE_URL') || supabaseUrl || '';
  
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: accessToken ? {
        Authorization: `Bearer ${accessToken}`,
      } : {},
    },
  });
}
