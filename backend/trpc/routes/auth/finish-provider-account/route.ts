import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { sessionProcedure } from '../../../create-context';
import { providerProfileAction, type AccountRole } from '../../../../lib/provider-profile';
import { ensureAccountIdentifier } from '../../../../lib/account-identifier';
import { missingOrderColumn } from '../../../../lib/order-row';

export const finishProviderAccountProcedure = sessionProcedure
  .input(z.object({
    role: z.enum(['platemaker', 'platetaker']),
    username: z.string().min(3).max(40).optional(),
    email: z.string().email().max(160).optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    const authUser = await ctx.supabaseAdmin.auth.admin.getUserById(ctx.userId);
    if (authUser.error || !authUser.data.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'That sign-in did not finish.' });
    }
    const account = authUser.data.user;
    const profileRead = await ctx.supabaseAdmin
      .from('profiles')
      .select('id, username, email, role, created_at')
      .eq('id', ctx.userId)
      .maybeSingle();
    if (profileRead.error) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'That sign-in could not be checked.' });
    }

    const profile = profileRead.data;
    const meals = await ctx.supabaseAdmin.from('meals').select('id').eq('user_id', ctx.userId).limit(1);
    let buyerOrders = await ctx.supabaseAdmin.from('orders').select('id').eq('buyer_id', ctx.userId).limit(1);
    if (buyerOrders.error && missingOrderColumn(buyerOrders.error.message, 'buyer_id')) {
      buyerOrders = await ctx.supabaseAdmin.from('orders').select('id').eq('platetaker_id', ctx.userId).limit(1);
    }
    let sellerOrders = await ctx.supabaseAdmin.from('orders').select('id').eq('seller_id', ctx.userId).limit(1);
    if (sellerOrders.error && missingOrderColumn(sellerOrders.error.message, 'seller_id')) {
      sellerOrders = await ctx.supabaseAdmin.from('orders').select('id').eq('platemaker_id', ctx.userId).limit(1);
    }
    if (meals.error || buyerOrders.error || sellerOrders.error) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'That sign-in could not be checked.' });
    }
    const hasActivity = (meals.data?.length ?? 0) + (buyerOrders.data?.length ?? 0) + (sellerOrders.data?.length ?? 0) > 0;
    const action = providerProfileAction({
      chosenRole: input.role,
      profileRole: profile?.role ?? null,
      accountCreatedAt: account.created_at ?? null,
      profileCreatedAt: profile?.created_at ?? null,
      hasActivity,
      now: Date.now(),
    });

    if (action.action === 'keep' && profile) {
      await ensureAccountIdentifier(ctx.supabaseAdmin, ctx.userId, profile.role === 'platemaker' ? 'platemaker' : 'platetaker');
      return { role: profile.role as AccountRole, username: profile.username as string };
    }

    if (action.action === 'correct' && profile) {
      const updated = await ctx.supabaseAdmin
        .from('profiles')
        .update({ role: 'platemaker' })
        .eq('id', ctx.userId)
        .select('role, username')
        .single();
      if (updated.error || !updated.data) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'The cook account could not be finished.' });
      }
      await ctx.supabaseAdmin.auth.admin.updateUserById(ctx.userId, {
        user_metadata: { ...(account.user_metadata ?? {}), role: 'platemaker', username: updated.data.username },
      });
      return { role: 'platemaker' as const, username: updated.data.username as string };
    }

    const typedName = input.username?.trim() ?? '';
    const typedEmail = input.email?.trim().toLowerCase() ?? '';
    if (!typedName) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enter the username you want on HomeCookedPlate.' });
    }
    if (!typedEmail) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enter an email you can open.' });
    }
    const cleanedName = typedName.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
    if (cleanedName.length < 3) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Use at least 3 letters or numbers in the username.' });
    }
    const emailChanged = await ctx.supabaseAdmin.auth.admin.updateUserById(ctx.userId, {
      email: typedEmail,
      email_confirm: true,
    });
    if (emailChanged.error) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This email already has an account. Sign in with that email, or use another email you can open.',
      });
    }
    const email = typedEmail;
    const names = [cleanedName];
    let saved: { role: string; username: string } | null = null;
    let lastMessage = '';
    for (const username of names) {
      const inserted = await ctx.supabaseAdmin
        .from('profiles')
        .insert({
          id: ctx.userId,
          username,
          email,
          role: input.role,
          is_admin: false,
        })
        .select('role, username')
        .single();
      if (!inserted.error && inserted.data) {
        saved = inserted.data;
        break;
      }
      const message = inserted.error?.message || '';
      const code = inserted.error && typeof inserted.error === 'object' && 'code' in inserted.error
        ? String(inserted.error.code)
        : '';
      lastMessage = message;
      if (code === '23505' && /username/i.test(message)) continue;
      if (code === '23505') {
        const existing = await ctx.supabaseAdmin
          .from('profiles')
          .select('role, username, created_at')
          .eq('id', ctx.userId)
          .maybeSingle();
        if (existing.data) {
          const again = providerProfileAction({
            chosenRole: input.role,
            profileRole: existing.data.role,
            accountCreatedAt: account.created_at ?? null,
            profileCreatedAt: existing.data.created_at ?? null,
            hasActivity,
            now: Date.now(),
          });
          if (again.action === 'correct') {
            const corrected = await ctx.supabaseAdmin
              .from('profiles')
              .update({ role: 'platemaker' })
              .eq('id', ctx.userId)
              .select('role, username')
              .single();
            if (!corrected.error && corrected.data) {
              saved = corrected.data;
              break;
            }
          }
          saved = existing.data;
          break;
        }
      }
      break;
    }

    if (!saved) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: /email/i.test(lastMessage)
          ? 'This email already has an account. Continue with Apple or Google.'
          : 'The account could not be finished.',
      });
    }

    await ctx.supabaseAdmin.auth.admin.updateUserById(ctx.userId, {
      user_metadata: {
        ...(account.user_metadata ?? {}),
        role: saved.role,
        username: saved.username,
        action_email_pending: true,
        action_email_sent: false,
      },
    });
    await ensureAccountIdentifier(
      ctx.supabaseAdmin,
      ctx.userId,
      saved.role === 'platemaker' ? 'platemaker' : 'platetaker',
    );
    return { role: saved.role as AccountRole, username: saved.username };
  });
