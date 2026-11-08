import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { mainAdminProcedure } from '../../../create-context';

export const restorePlatemakerSellingProcedure = mainAdminProcedure
  .input(z.object({ platemakerId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const existing = await ctx.supabaseAdmin
      .from('profiles')
      .select('final_payout_at')
      .eq('id', input.platemakerId)
      .eq('role', 'platemaker')
      .maybeSingle();
    const finalAt = !existing.error && typeof existing.data?.final_payout_at === 'string'
      ? existing.data.final_payout_at
      : null;
    const patch: { selling_removed: boolean; selling_removed_reason: null; final_payout_at?: null } = {
      selling_removed: false,
      selling_removed_reason: null,
      final_payout_at: null,
    };
    let { error } = await ctx.supabaseAdmin
      .from('profiles')
      .update(patch)
      .eq('id', input.platemakerId)
      .eq('role', 'platemaker');
    if (error && /final_payout_at/i.test(error.message || '')) {
      const retry = await ctx.supabaseAdmin
        .from('profiles')
        .update({ selling_removed: false, selling_removed_reason: null })
        .eq('id', input.platemakerId)
        .eq('role', 'platemaker');
      error = retry.error;
    }

    if (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to restore selling' });
    }

    if (finalAt) {
      const held = await ctx.supabaseAdmin
        .from('transactions')
        .select('id, payout_release_at')
        .eq('seller_id', input.platemakerId)
        .eq('status', 'held')
        .limit(200);
      const now = new Date().toISOString();
      for (const row of held.data ?? []) {
        if (row.payout_release_at !== finalAt) continue;
        await ctx.supabaseAdmin
          .from('transactions')
          .update({ payout_release_at: now, payout_next_attempt_at: null })
          .eq('id', row.id)
          .eq('status', 'held');
      }
    }

    return { restored: true };
  });
