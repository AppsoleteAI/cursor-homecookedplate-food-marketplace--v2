import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';

export const listNotificationsProcedure = protectedProcedure.query(async ({ ctx }) => {
  const { data, error } = await ctx.supabaseAdmin
    .from('notifications')
    .select('id, title, body, created_at')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    if (/notifications/i.test(error.message || '')) return [];
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Notifications could not be loaded.' });
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: typeof row.title === 'string' ? row.title : 'Update',
    body: typeof row.body === 'string' ? row.body : '',
    date: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  }));
});
