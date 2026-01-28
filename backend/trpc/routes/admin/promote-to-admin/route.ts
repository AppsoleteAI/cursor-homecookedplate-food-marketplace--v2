import { adminProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminPromoteUser } from "../../../../lib/security";

export const promoteToAdminProcedure = adminProcedure
  .input(z.object({ userId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    // Verify the target user exists
    const { data: profile, error: profileError } = await ctx.supabaseAdmin
      .from('profiles')
      .select('id, username, email, is_admin')
      .eq('id', input.userId)
      .single();

    if (profileError || !profile) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `User with ID ${input.userId} not found`,
      });
    }

    if (profile.is_admin) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'User is already an admin',
      });
    }

    // Use the security helper which calls the RPC function defined in SQL Section 9
    // This requires service_role key (ctx.supabaseAdmin)
    try {
      await adminPromoteUser(ctx.supabaseAdmin, input.userId);
      
      // Log the promotion action (the RPC function also logs, but we log here for tRPC context)
      await ctx.supabaseAdmin
        .from('audit_logs')
        .insert({
          user_id: ctx.userId,
          action: 'PROMOTE_TO_ADMIN',
          table_name: 'profiles',
          record_id: input.userId,
          new_data: {
            promoted_by: ctx.userId,
            target_username: profile.username,
            target_email: profile.email,
          },
        });

      return { 
        success: true,
        message: `User ${profile.username} (${profile.email}) has been promoted to admin`,
      };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to promote user to admin',
      });
    }
  });
