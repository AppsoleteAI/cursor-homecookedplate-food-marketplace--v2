import { adminProcedure } from '../../../create-context';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { sanitizeTextField } from '../../../../lib/text-security';
import { notifyParty } from '../../../../lib/account-notice';

function firstImage(value: unknown): string | null {
  if (typeof value === 'string' && value.startsWith('http')) return value;
  if (Array.isArray(value)) {
    const found = value.find((item) => typeof item === 'string' && item.startsWith('http'));
    return typeof found === 'string' ? found : null;
  }
  return null;
}

export const listMonitorPlatesProcedure = adminProcedure.query(async ({ ctx }) => {
  const { data, error } = await ctx.supabaseAdmin
    .from('meals')
    .select('id, name, description, images')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Plates could not be loaded.' });
  }

  return (data ?? []).map((meal) => ({
    id: meal.id as string,
    name: typeof meal.name === 'string' ? meal.name : '',
    description: typeof meal.description === 'string' ? meal.description : '',
    image: firstImage(meal.images),
  }));
});

export const updateMonitorPlateProcedure = adminProcedure
  .input(z.object({
    mealId: z.string().min(1),
    name: z.string().min(1).max(80),
    description: z.string().max(500),
  }))
  .mutation(async ({ ctx, input }) => {
    const name = sanitizeTextField(input.name);
    const description = sanitizeTextField(input.description);
    if (name.blocked || description.blocked || name.value.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That plate text was not accepted.' });
    }

    const { data, error } = await ctx.supabaseAdmin
      .from('meals')
      .update({ name: name.value, description: description.value })
      .eq('id', input.mealId)
      .select('id, name, description, user_id')
      .maybeSingle();

    if (error || !data) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The plate text was not saved.' });
    }

    try {
      await notifyParty(ctx.supabaseAdmin, data.user_id as string, 'orderUpdates', {
        title: 'Plate update',
        body: 'An admin renamed this plate. The price and the published state stayed the same.',
      }, { evenWhenOrderUpdatesOff: true });
    } catch (noticeError) {
      console.error('[Monitor] Plate notice failed:', noticeError);
    }

    return { id: data.id as string, name: data.name as string, description: data.description as string };
  });

export const listScreenNamesProcedure = adminProcedure.query(async ({ ctx }) => {
  const { data, error } = await ctx.supabaseAdmin
    .from('profiles')
    .select('id, username')
    .order('username', { ascending: true })
    .limit(40);

  if (error) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Screen names could not be loaded.' });
  }

  return (data ?? []).map((profile) => ({
    id: profile.id as string,
    username: typeof profile.username === 'string' ? profile.username : '',
  }));
});

export const updateScreenNameProcedure = adminProcedure
  .input(z.object({
    userId: z.string().uuid(),
    username: z.string().min(3).max(40),
  }))
  .mutation(async ({ ctx, input }) => {
    const username = sanitizeTextField(input.username);
    if (username.blocked || username.value.length < 3) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That screen name was not accepted.' });
    }

    const { data, error } = await ctx.supabaseAdmin
      .from('profiles')
      .update({ username: username.value })
      .eq('id', input.userId)
      .select('id, username')
      .maybeSingle();

    if (error || !data) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The screen name was not saved.' });
    }

    try {
      await notifyParty(ctx.supabaseAdmin, data.id as string, 'orderUpdates', {
        title: 'Screen name',
        body: 'An admin changed your screen name.',
      }, { evenWhenOrderUpdatesOff: true });
    } catch (noticeError) {
      console.error('[Monitor] Screen name notice failed:', noticeError);
    }

    return { id: data.id as string, username: data.username as string };
  });
