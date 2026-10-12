import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { refundHalfDisputeFee } from '../../../../lib/stripe-marketplace';
import { SUPPORT_EMAIL } from '../../../../lib/payout-policy';

export const blockPlatetakerProcedure = protectedProcedure
  .input(z.object({ platetakerId: z.string().uuid() }))
  .mutation(async ({ ctx, input }) => {
    const { data: profile, error } = await ctx.supabase
      .from('profiles')
      .select('role')
      .eq('id', ctx.userId)
      .single();

    if (error || profile?.role !== 'platemaker') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only a platemaker can block a platetaker' });
    }

    if (input.platetakerId === ctx.userId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'You cannot block your own account' });
    }

    const { error: insertError } = await ctx.supabaseAdmin.from('cook_buyer_blocks').insert({
      platemaker_id: ctx.userId,
      platetaker_id: input.platetakerId,
    });

    if (insertError && insertError.code !== '23505') {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The block was not saved' });
    }

    const returned = await refundHalfDisputeFee(
      ctx.supabaseAdmin,
      process.env.STRIPE_SECRET_KEY,
      ctx.userId,
      input.platetakerId,
    );

    const { count: stillOwed } = await ctx.supabaseAdmin
      .from('platetaker_lost_disputes')
      .select('id', { count: 'exact', head: true })
      .eq('platemaker_id', ctx.userId)
      .eq('platetaker_id', input.platetakerId)
      .eq('fee_half_refunded', false);

    const pending = stillOwed ?? 0;
    const notice = returned > 0
      ? `You blocked this PlateTaker from your plates. Half of the lost dispute fee is returned on ${returned} dispute${returned === 1 ? '' : 's'} ($7.50 each).`
      : pending > 0
        ? `You blocked this PlateTaker from your plates. Half of the $15 fee ($7.50) still needs to be returned. Write to ${SUPPORT_EMAIL} and we will finish it.`
        : `You blocked this PlateTaker from your plates.`;

    await ctx.supabaseAdmin.from('notifications').insert({
      user_id: ctx.userId,
      title: 'PlateTaker blocked',
      body: notice,
      type: 'responsibility',
      read: false,
    });

    return {
      blocked: true,
      halfFeesReturned: returned,
      pendingHalfFees: pending,
      supportEmail: SUPPORT_EMAIL,
    };
  });
