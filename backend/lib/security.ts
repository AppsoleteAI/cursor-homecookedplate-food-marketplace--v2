import { SupabaseClient } from '@supabase/supabase-js';

/**
 * MANDATORY SECURITY INTERFACE [2026-01-27]
 * Matches SQL enhancements for: Price protection, Admin bypass, and Audit logging.
 * 
 * This file provides TypeScript types and helper functions to manage the new security features,
 * specifically handling the is_admin state and secure profile updates.
 */

/**
 * Types for the enhanced Security Schema
 */
export interface Profile {
  id: string;
  username: string;
  email: string;
  role: 'platemaker' | 'platetaker';
  is_admin: boolean; // Locked in DB via RLS - cannot be changed by users
  created_at: string;
}

export interface AuditLogEntry {
  action: string;
  table_name: string;
  record_id?: string;
  old_data?: any;
  new_data?: any;
}

/**
 * Checks if the current authenticated user has admin privileges.
 * Useful for frontend conditional rendering or client-side checks.
 * 
 * Note: The SQL function `public.is_admin()` has execute permissions revoked from
 * anon/authenticated roles, so we query the profiles table directly instead.
 * RLS will automatically filter to the current authenticated user's profile.
 * 
 * For server-side/tRPC use, see adminProcedure in backend/trpc/create-context.ts
 * which queries with explicit userId filtering.
 * 
 * Corresponds to SQL Section 4 (public.is_admin function logic)
 * 
 * @param supabase - Authenticated Supabase client (will check the current user)
 */
export async function checkIsAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .single();

  if (error || !data) return false;
  return data.is_admin;
}

/**
 * Securely updates a profile.
 * 
 * IMPORTANT: The 'is_admin' field is protected by RLS policy "update_own_profile"
 * which will reject the update if the submitted is_admin differs from the stored value.
 * 
 * Corresponds to SQL Section 3 (update_own_profile policy)
 * 
 * @param supabase - Authenticated Supabase client
 * @param userId - User ID to update
 * @param updates - Profile fields to update (is_admin is ignored/blocked by RLS)
 */
export async function updateProfile(
  supabase: SupabaseClient, 
  userId: string, 
  updates: Partial<Omit<Profile, 'is_admin' | 'id'>>
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    // This will catch the RLS "check" failure if someone tries is_admin escalation
    throw new Error(`Security violation or update failed: ${error.message}`);
  }
  return data;
}

/**
 * Submit a review with order_id validation.
 * 
 * Corresponds to SQL Section 5 (insert_review_after_purchase policy)
 * The RLS policy requires:
 * - author_id = auth.uid()
 * - order_id must exist and belong to the user
 * - order status must be 'completed'
 * - No duplicate reviews for the same order
 * 
 * @param supabase - Authenticated Supabase client
 * @param reviewData - Review data including required order_id
 */
export async function submitReview(
  supabase: SupabaseClient,
  reviewData: {
    meal_id: string;
    order_id: string; // REQUIRED: Links review to specific completed order
    rating: number;
    comment?: string;
  }
) {
  const { data, error } = await supabase
    .from('reviews')
    .insert([reviewData])
    .select()
    .single();

  if (error) {
    throw new Error(`Review rejected: ${error.message}`);
  }
  return data;
}

/**
 * Admin-Only: Promote a user to admin.
 * 
 * WARNING: This must be called with a service_role key client as EXECUTE permissions 
 * are revoked from 'anon' and 'authenticated' roles in SQL Section 9.
 * 
 * Corresponds to SQL Section 9 (promote_to_admin function)
 * 
 * @param supabaseServiceRole - Supabase client with service_role key
 * @param targetUserId - User ID to promote to admin
 */
export async function adminPromoteUser(
  supabaseServiceRole: SupabaseClient, 
  targetUserId: string
) {
  const { error } = await supabaseServiceRole
    .rpc('promote_to_admin', { target_user_id: targetUserId });

  if (error) {
    throw new Error(`Admin promotion failed: ${error.message}`);
  }
  return { success: true };
}
