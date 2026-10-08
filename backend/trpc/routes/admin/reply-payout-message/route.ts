import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { adminProcedure } from '../../../create-context';
import { sanitizeTextField } from '../../../../lib/text-security';

export const replyPayoutMessageProcedure = adminProcedure
  .input(
    z.object({
      platemakerId: z.string().uuid(),
      body: z.string().min(1).max(2000),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const scanned = sanitizeTextField(input.body.trim());
    if (scanned.blocked || scanned.value.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That message cannot be sent' });
    }

    const { error } = await ctx.supabaseAdmin.from('platemaker_admin_messages').insert({
      platemaker_id: input.platemakerId,
      sender_id: ctx.userId,
      sender_role: 'admin',
      body: scanned.value,
    });

    if (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to send reply' });
    }

    return { sent: true };
  });
