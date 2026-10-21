import { mainAdminProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

const roleInput = z.enum(['main', 'monitor', 'none']);

export const promoteToAdminProcedure = mainAdminProcedure
  .input(z.object({
    userId: z.string().uuid(),
    role: roleInput,
  }))
  .mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.userId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'The main admin row is changed in Supabase, not from this screen.',
      });
    }

    const { data: profile, error: profileError } = await ctx.supabaseAdmin
      .from('profiles')
      .select('id, username')
      .eq('id', input.userId)
      .single();

    if (profileError || !profile) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'That account was not found.',
      });
    }

    const next = {
      main_admin: input.role === 'main',
      monitor_admin: input.role === 'monitor',
      is_admin: input.role !== 'none',
    };

    const { error } = await ctx.supabaseAdmin
      .from('profiles')
      .update(next)
      .eq('id', input.userId);

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'The admin checkboxes are not on profiles yet. Run the admin role SQL in Supabase first.',
      });
    }

    await ctx.supabaseAdmin.from('audit_logs').insert({
      user_id: ctx.userId,
      action: input.role === 'none' ? 'ADMIN_REMOVED' : 'ADMIN_ROLE_SET',
      table_name: 'profiles',
      record_id: input.userId,
      new_data: { role: input.role, username: profile.username },
    });

    const label = input.role === 'main'
      ? 'Main admin'
      : input.role === 'monitor'
        ? 'Monitor admin'
        : 'Not an admin';

    return { message: `${profile.username} is now ${label}.` };
  });
