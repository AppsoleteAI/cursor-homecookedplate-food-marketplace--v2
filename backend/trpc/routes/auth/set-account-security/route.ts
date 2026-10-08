import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { accountSecurityColumns } from '../../../../lib/account-security';
import { protectedProcedure } from '../../../create-context';

export const setAccountSecurityProcedure = protectedProcedure
  .input(
    z.object({
      isPaused: z.boolean().optional(),
      twoFactorEnabled: z.boolean().optional(),
    }).refine((value) => value.isPaused !== undefined || value.twoFactorEnabled !== undefined, {
      message: 'Nothing to update',
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const updateData = accountSecurityColumns(input);

    // The id is the verified JWT subject. Service role writes these two flags
    // so a profile policy cannot drop the update.
    const { data: profile, error } = await ctx.supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', ctx.userId)
      .select('is_paused, two_factor_enabled')
      .single();

    if (error || !profile) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error?.message || 'Failed to update account security',
      });
    }

    return {
      isPaused: Boolean(profile.is_paused),
      twoFactorEnabled: Boolean(profile.two_factor_enabled),
    };
  });
