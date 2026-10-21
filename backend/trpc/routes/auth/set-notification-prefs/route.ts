import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { readNoticePrefs, saveNoticePrefs } from '../../../../lib/account-notice';
import { sendNoticeEmail } from '../../../../lib/email';

const prefs = z.object({
  orderUpdates: z.boolean(),
  newMessages: z.boolean(),
  paymentAlerts: z.boolean(),
  reviewsRatings: z.boolean(),
  promotions: z.boolean(),
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
});

export const setNotificationPrefsProcedure = protectedProcedure
  .input(prefs)
  .mutation(async ({ ctx, input }) => {
    const previous = await readNoticePrefs(ctx.supabaseAdmin, ctx.userId);
    if (input.emailNotifications && !previous.emailNotifications) {
      const { data: profile } = await ctx.supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', ctx.userId)
        .maybeSingle();
      if (profile?.email) {
        const sent = await sendNoticeEmail(
          profile.email,
          'Email notices are on',
          'HomeCookedPlate will email you about orders, messages, payments, and reviews when those switches are on.',
        );
        if (!sent) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'The confirmation email could not be sent. The email switch was left off.',
          });
        }
      }
    }
    try {
      await saveNoticePrefs(ctx.supabaseAdmin, ctx.userId, input);
    } catch (error) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: error instanceof Error ? error.message : 'Notification settings could not be saved.',
      });
    }
    return input;
  });
