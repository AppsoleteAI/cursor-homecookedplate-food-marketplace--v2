import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { sessionProcedure } from '../../../create-context';
import { providerProfileAction, usernameCandidates, type AccountRole } from '../../../../lib/provider-profile';

export const finishProviderAccountProcedure = sessionProcedure
  .input(z.object({
    role: z.enum(['platemaker', 'platetaker']),
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
    const [meals, buyerOrders, sellerOrders] = await Promise.all([
      ctx.supabaseAdmin.from('meals').select('id').eq('user_id', ctx.userId).limit(1),
      ctx.supabaseAdmin.from('orders').select('id').eq('buyer_id', ctx.userId).limit(1),
      ctx.supabaseAdmin.from('orders').select('id').eq('seller_id', ctx.userId).limit(1),
    ]);
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

    const email = account.email || `${ctx.userId}@users.local`;
    const metadataName = typeof account.user_metadata?.username === 'string' ? account.user_metadata.username : null;
    const names = usernameCandidates(account.email, ctx.userId, metadataName);
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
      user_metadata: { ...(account.user_metadata ?? {}), role: saved.role, username: saved.username },
    });
    return { role: saved.role as AccountRole, username: saved.username };
  });
