import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { lifetimeShouldSaveDevice } from "../../../../lib/lifetime-device";

/**
 * Hardware Audit Procedure
 * Validates device ID for lifetime subscribers to prevent unauthorized transfers.
 * 
 * Logic:
 * - Non-lifetime users: always allowed
 * - Lifetime users with no device_id: allowed (first-time setup)
 * - Lifetime users with matching device_id: allowed
 * - Lifetime users with a different device_id: this signed-in device is saved and allowed
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

    if (!lifetimeShouldSaveDevice(profile.device_id, deviceId)) {
      return { allowed: true };
    }

    const saved = await ctx.supabaseAdmin
      .from('profiles')
      .update({ device_id: deviceId })
      .eq('id', userId);
    if (saved.error) {
      console.error('[HardwareAudit] Could not save this device:', saved.error.message);
    }
    try {
      await ctx.supabaseAdmin
        .from('audit_logs')
        .insert({
          user_id: userId,
          action: 'HARDWARE_DEVICE_SAVED',
          table_name: 'profiles',
          record_id: userId,
          new_data: { deviceId },
        });
    } catch (error) {
      console.error('[HardwareAudit] Failed to insert audit log:', error);
    }

    return { allowed: true };
  });
