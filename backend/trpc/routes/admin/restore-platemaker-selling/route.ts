import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { adminProcedure } from '../../../create-context';

export const restorePlatemakerSellingProcedure = adminProcedure
  .input(z.object({ platemakerId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const { error } = await ctx.supabaseAdmin
      .from('profiles')
      .update({
        selling_removed: false,
        selling_removed_reason: null,
      })
      .eq('id', input.platemakerId)
      .eq('role', 'platemaker');

    if (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to restore selling' });
    }

    return { restored: true };
  });
