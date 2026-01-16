import { createClient } from '@supabase/supabase-js';

// Read environment variables from backend/.env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate all required environment variables are present
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
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * CLIENT 2: Admin Client (God Mode)
 * Use this for: Signup (admin.createUser), deleting users, 
 * or bypassing RLS during server-side logic.
 * 
 * This client uses the service role key, which bypasses RLS.
 * Used by: Signup route, webhooks, account recovery
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Keep createServerSupabaseClient for user-scoped operations with RLS
export function createServerSupabaseClient(accessToken?: string) {
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || supabaseAnonKey || '';
  const url = supabaseUrl || '';
  
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
