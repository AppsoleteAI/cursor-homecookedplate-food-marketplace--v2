import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { adminProcedure } from '../../../create-context';
import { sanitizeTextField } from '../../../../lib/text-security';
import { recordResponsibilityEvent } from '../../../../lib/stripe-marketplace';

export const recordResponsibilityProcedure = adminProcedure
  .input(
    z.object({
      platemakerId: z.string().uuid(),
      kind: z.enum(['complaint', 'government_request']),
      note: z.string().min(1).max(2000),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const scanned = sanitizeTextField(input.note.trim());
    if (scanned.blocked || scanned.value.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That note cannot be saved' });
    }

    const { data: cook } = await ctx.supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', input.platemakerId)
      .single();

    if (!cook || cook.role !== 'platemaker') {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Platemaker not found' });
    }

    const recorded = await recordResponsibilityEvent(ctx.supabaseAdmin, {
      platemakerId: input.platemakerId,
      kind: input.kind,
      note: scanned.value,
      createdBy: ctx.userId,
    });

    if (!recorded) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to record the event' });
    }

    return { recorded: true };
  });
