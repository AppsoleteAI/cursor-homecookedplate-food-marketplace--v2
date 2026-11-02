import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { readActiveAppleSubscription, readAppleTransactionClaims } from '../../../../lib/apple-transaction';
import { missingStoreDateColumn } from '../../../../lib/store-membership';
import { resolvedMembershipTier } from '../../../../lib/trial-access';
import { protectedProcedure } from '../../../create-context';

export const confirmAppleProcedure = protectedProcedure
  .input(z.object({
    signedTransaction: z.string().min(40).max(32000),
  }))
  .mutation(async ({ ctx, input }) => {
    let subscription;
    let ended = false;
    try {
      subscription = readActiveAppleSubscription(input.signedTransaction);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The App Store transaction could not be verified.';
      if (message !== 'Subscription was revoked' && message !== 'Subscription is expired') {
        throw new TRPCError({ code: 'BAD_REQUEST', message });
      }
      try {
        subscription = readAppleTransactionClaims(input.signedTransaction);
      } catch (claimsError) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: claimsError instanceof Error ? claimsError.message : message,
        });
      }
      ended = true;
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

    const { data: current } = await ctx.supabaseAdmin
      .from('profiles')
      .select('role, membership_tier, trial_ends_at, stripe_subscription_id, google_purchase_token, google_expires_at')
      .eq('id', ctx.userId)
      .maybeSingle();
    const nextTier = ended
      ? resolvedMembershipTier({
        ...(current ?? { role: null, membership_tier: 'free', trial_ends_at: null }),
        apple_original_transaction_id: subscription.originalTransactionId,
        apple_expires_at: new Date(subscription.expiresDate).toISOString(),
        apple_revoked_at: ended && 'revoked' in subscription && subscription.revoked ? new Date().toISOString() : null,
      })
      : 'premium' as const;
    let update = await ctx.supabaseAdmin
      .from('profiles')
      .update({
        membership_tier: nextTier,
        apple_original_transaction_id: subscription.originalTransactionId,
        apple_expires_at: new Date(subscription.expiresDate).toISOString(),
        apple_revoked_at: ended && 'revoked' in subscription && subscription.revoked ? new Date().toISOString() : null,
        apple_auto_renew: !ended,
        apple_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ctx.userId);
    if (missingStoreDateColumn(update.error)) {
      update = await ctx.supabaseAdmin
        .from('profiles')
        .update({
          membership_tier: nextTier,
          apple_original_transaction_id: subscription.originalTransactionId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ctx.userId);
    }
    const updateError = update.error;

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
      membershipTier: nextTier,
      productId: subscription.productId,
      expiresAt: new Date(subscription.expiresDate).toISOString(),
      environment: subscription.environment,
    };
  });
