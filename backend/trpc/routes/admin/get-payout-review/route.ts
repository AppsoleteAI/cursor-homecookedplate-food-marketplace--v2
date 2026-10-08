import { adminProcedure } from '../../../create-context';
import { releaseDuePayouts } from '../../../../lib/stripe-marketplace';
import { responsibilityWindowStart } from '../../../../lib/payout-policy';

export const getPayoutReviewProcedure = adminProcedure.query(async ({ ctx }) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (stripeSecretKey) {
    await releaseDuePayouts(ctx.supabaseAdmin, stripeSecretKey);
  }

  const { data: events } = await ctx.supabaseAdmin
    .from('platemaker_responsibility_events')
    .select('id, platemaker_id, kind, note, created_at')
    .gte('created_at', responsibilityWindowStart())
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: removed } = await ctx.supabaseAdmin
    .from('profiles')
    .select('id, username, email, selling_removed, selling_removed_reason')
    .eq('selling_removed', true)
    .limit(100);

  const ids = new Set<string>();
  for (const event of events ?? []) ids.add(event.platemaker_id);
  for (const profile of removed ?? []) ids.add(profile.id);

  const { data: profiles } = ids.size
    ? await ctx.supabaseAdmin
        .from('profiles')
        .select('id, username, email, selling_removed, selling_removed_reason')
        .in('id', [...ids])
    : { data: [] as { id: string; username: string | null; email: string | null; selling_removed: boolean; selling_removed_reason: string | null }[] };

  const { data: messages } = await ctx.supabaseAdmin
    .from('platemaker_admin_messages')
    .select('id, platemaker_id, sender_role, body, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  return {
    cooks: (profiles ?? []).map((profile) => ({
      id: profile.id,
      username: profile.username,
      email: profile.email,
      sellingRemoved: profile.selling_removed === true,
      sellingRemovedReason: profile.selling_removed_reason,
      events: (events ?? [])
        .filter((event) => event.platemaker_id === profile.id)
        .map((event) => ({
          id: event.id,
          kind: event.kind,
          note: event.note,
          createdAt: event.created_at,
        })),
    })),
    messages: (messages ?? []).map((row) => ({
      id: row.id,
      platemakerId: row.platemaker_id,
      senderRole: row.sender_role,
      body: row.body,
      createdAt: row.created_at,
    })),
  };
});
