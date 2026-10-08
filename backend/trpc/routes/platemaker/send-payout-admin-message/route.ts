import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { sanitizeTextField } from '../../../../lib/text-security';

export const sendPayoutAdminMessageProcedure = protectedProcedure
  .input(z.object({ body: z.string().min(1).max(2000) }))
  .mutation(async ({ ctx, input }) => {
    const { data: profile, error } = await ctx.supabase
      .from('profiles')
      .select('role')
      .eq('id', ctx.userId)
      .single();

    if (error || profile?.role !== 'platemaker') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only platemakers can message admins here' });
    }

    const scanned = sanitizeTextField(input.body.trim());
    if (scanned.blocked || scanned.value.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That message cannot be sent' });
    }

    const { error: insertError } = await ctx.supabaseAdmin.from('platemaker_admin_messages').insert({
      platemaker_id: ctx.userId,
      sender_id: ctx.userId,
      sender_role: 'platemaker',
      body: scanned.value,
    });

    if (insertError) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to send message' });
    }

    return { sent: true };
  });
