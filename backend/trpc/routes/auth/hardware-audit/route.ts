import { protectedProcedure } from "../../../create-context";
import { z } from "zod";

/**
 * Hardware Audit Procedure
 * Validates device ID for lifetime subscribers to prevent unauthorized transfers.
 * 
 * Logic:
 * - Non-lifetime users: always allowed
 * - Lifetime users with no device_id: allowed (first-time setup)
 * - Lifetime users with matching device_id: allowed
 * - Lifetime users with mismatched device_id: blocked and logged
 */
export const hardwareAuditProcedure = protectedProcedure
  .input(
    z.object({
      deviceId: z.string().min(1, "Device ID is required"),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.userId;
    const { deviceId } = input;

    // Fetch user profile
    const { data: profile, error: profileError } = await ctx.supabase
      .from('profiles')
      .select('device_id, membership_tier')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      // Fail open: if we can't fetch profile, allow access
      return { allowed: true };
    }

    // Non-lifetime users: always allowed
    if (profile.membership_tier !== 'lifetime') {
      return { allowed: true };
    }

    // Lifetime users with no device_id: allowed (first-time setup)
    if (!profile.device_id || profile.device_id.trim() === '') {
      return { allowed: true };
    }

    // Lifetime users with matching device_id: allowed
    if (profile.device_id === deviceId) {
      return { allowed: true };
    }

    // Lifetime users with mismatched device_id: blocked and logged
    // Use admin client to insert audit log (bypasses RLS)
    try {
      await ctx.supabaseAdmin
        .from('audit_logs')
        .insert({
          user_id: userId,
          action: 'HARDWARE_MISMATCH',
          table_name: 'profiles',
          record_id: userId,
          new_data: {
            attempted_device: deviceId,
            original_device: profile.device_id,
          },
        });
    } catch (error) {
      // Log error but don't fail the audit check
      console.error('[HardwareAudit] Failed to insert audit log:', error);
    }

    return {
      allowed: false,
      reason: 'LIFETIME_DEVICE_MISMATCH',
    };
  });
