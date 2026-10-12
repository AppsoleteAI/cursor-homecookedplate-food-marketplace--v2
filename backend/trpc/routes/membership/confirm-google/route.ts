import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { readActiveGoogleSubscription } from '../../../../lib/google-play';
import { protectedProcedure } from '../../../create-context';

export const confirmGoogleProcedure = protectedProcedure
  .input(z.object({
    purchaseToken: z.string().min(20).max(8000),
  }))
  .mutation(async ({ ctx, input }) => {
    const serviceAccountJson = ctx.googlePlayServiceAccountJson || process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Play Billing verification is not configured.',
      });
    }

    let subscription;
    try {
      subscription = await readActiveGoogleSubscription(input.purchaseToken, {
        serviceAccountJson,
        userId: ctx.userId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The Play purchase could not be verified.';
      throw new TRPCError({
        code: message === 'Play Billing verification is not configured.' ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST',
        message,
      });
    }

    const { data: existing, error: lookupError } = await ctx.supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('google_purchase_token', subscription.purchaseToken)
      .maybeSingle();

    if (lookupError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: lookupError.code === 'PGRST204'
          ? 'Play subscription storage is not ready.'
          : 'Could not check the Play subscription.',
      });
    }

    if (existing && existing.id !== ctx.userId) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This Play subscription is already linked to another account.',
      });
    }

    const { error: updateError } = await ctx.supabaseAdmin
      .from('profiles')
      .update({
        membership_tier: 'premium',
        google_purchase_token: subscription.purchaseToken,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.userId);

    if (updateError) {
      if (updateError.code === '23505') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This Play subscription is already linked to another account.',
        });
      }
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: updateError.code === 'PGRST204'
          ? 'Play subscription storage is not ready.'
          : 'Could not record the Play subscription.',
      });
    }

    return {
      membershipTier: 'premium' as const,
      productId: subscription.productId,
      expiresAt: subscription.expiresAt,
    };
  });
