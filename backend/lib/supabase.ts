import { createClient } from '@supabase/supabase-js';

// 1. Pull keys from your verified .env
const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("❌ SUPABASE_URL is missing in backend/.env");
}

// 2. Standard Client (Respects RLS - for general use)
export const supabase = createClient(supabaseUrl!, supabaseAnonKey!);

// 3. Admin Client (Bypasses RLS - for signup, webhooks, and recovery)
// This uses the Service Role Key from Supabase Dashboard
export const supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Keep createServerSupabaseClient for user-scoped operations with RLS
export function createServerSupabaseClient(accessToken?: string) {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
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
