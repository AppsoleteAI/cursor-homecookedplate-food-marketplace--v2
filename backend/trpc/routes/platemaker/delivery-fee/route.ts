import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { calculateDeliveryLevy } from '../../../../lib/fees';
import { normalizeDeliveryFee, savedDeliveryFee } from '../../../../lib/delivery-fee';

export const getDeliveryFeeProcedure = protectedProcedure
  .input(z.object({
    sellerId: z.string().uuid(),
  }))
  .query(async ({ input, ctx }) => {
    const deliveryFee = await savedDeliveryFee(ctx.supabaseAdmin, input.sellerId);
    return { sellerId: input.sellerId, ...calculateDeliveryLevy(deliveryFee) };
  });

export const setDeliveryFeeProcedure = protectedProcedure
  .input(z.object({
    amount: z.number().min(0).max(50),
  }))
  .mutation(async ({ input, ctx }) => {
    const { data: profile, error: profileError } = await ctx.supabase
      .from('profiles')
      .select('role')
      .eq('id', ctx.userId)
      .single();
    if (profileError || !profile) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch user profile' });
    }
    if (profile.role !== 'platemaker') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only a PlateMaker can set a delivery fee.' });
    }
    let amount: number;
    try {
      amount = normalizeDeliveryFee(input.amount);
    } catch (error) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: error instanceof Error ? error.message : 'That delivery fee is not valid.',
      });
    }
    const { error } = await ctx.supabaseAdmin.from('audit_logs').insert({
      user_id: ctx.userId,
      action: 'DELIVERY_FEE',
      table_name: 'profiles',
      new_data: { amount },
    });
    if (error) {
      console.error('[DeliveryFee] Write failed:', error.message);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The delivery fee could not be saved.' });
    }
    return { sellerId: ctx.userId, ...calculateDeliveryLevy(amount) };
  });
