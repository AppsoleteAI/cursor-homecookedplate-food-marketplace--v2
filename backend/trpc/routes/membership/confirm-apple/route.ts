import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { readActiveAppleSubscription } from '../../../../lib/apple-transaction';
import { protectedProcedure } from '../../../create-context';

export const confirmAppleProcedure = protectedProcedure
  .input(z.object({
    signedTransaction: z.string().min(40).max(32000),
  }))
  .mutation(async ({ ctx, input }) => {
    let subscription;
    try {
      subscription = readActiveAppleSubscription(input.signedTransaction);
    } catch (error) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: error instanceof Error ? error.message : 'The App Store transaction could not be verified.',
      });
    }

    const { data: existing, error: lookupError } = await ctx.supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('apple_original_transaction_id', subscription.originalTransactionId)
      .maybeSingle();

    if (lookupError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: lookupError.code === 'PGRST204'
          ? 'App Store subscription storage is not ready.'
          : 'Could not check the App Store subscription.',
      });
    }

    if (existing && existing.id !== ctx.userId) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This App Store subscription is already linked to another account.',
      });
    }

    const { error: updateError } = await ctx.supabaseAdmin
      .from('profiles')
      .update({
        membership_tier: 'premium',
        apple_original_transaction_id: subscription.originalTransactionId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.userId);

    if (updateError) {
      if (updateError.code === '23505') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This App Store subscription is already linked to another account.',
        });
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: updateError.code === 'PGRST204'
          ? 'App Store subscription storage is not ready.'
          : 'Could not record the App Store subscription.',
      });
    }

    return {
      membershipTier: 'premium' as const,
      productId: subscription.productId,
      expiresAt: new Date(subscription.expiresDate).toISOString(),
      environment: subscription.environment,
    };
  });
