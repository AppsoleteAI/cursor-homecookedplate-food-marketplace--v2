import { TRPCError } from '@trpc/server';
import { saveEarlyBirdClaim } from '../../../../lib/early-bird-claim';
import { addDays, readEarlyBirdOffer } from '../../../../lib/early-bird';
import { REMOTE_KITCHEN_DAYS } from '../../../../lib/remote-kitchen';
import { protectedProcedure } from '../../../create-context';

async function pinClaimMetro(admin: { from: (table: string) => any }, userId: string) {
  const { data } = await admin.from('profiles').select('metro_area, trial_ends_at').eq('id', userId).maybeSingle();
  if (!data?.trial_ends_at || typeof data.metro_area !== 'string') return;
  await saveEarlyBirdClaim(admin, userId, data.metro_area);
}

function missingStartColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST204' || /trial_started_at/.test(error.message || '');
}

export const earlyBirdOfferProcedure = protectedProcedure.query(async ({ ctx }) => {
  return readEarlyBirdOffer(ctx.supabaseAdmin, ctx.userId);
});

export const claimEarlyBirdProcedure = protectedProcedure.mutation(async ({ ctx }) => {
  const offer = await readEarlyBirdOffer(ctx.supabaseAdmin, ctx.userId);
  const remoteStart = !offer.eligible && offer.remoteKitchen;
  if (!offer.eligible && !remoteStart) {
    if (offer.trialEndsAt && Date.parse(offer.trialEndsAt) > Date.now()) {
      await pinClaimMetro(ctx.supabaseAdmin, ctx.userId);
      return {
        trialStartedAt: offer.trialStartedAt,
        trialEndsAt: offer.trialEndsAt,
        trialDays: 0,
        alreadyStarted: true,
        remoteKitchen: false,
      };
    }
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Early Bird is not available for this account.',
    });
  }

  const days = remoteStart ? REMOTE_KITCHEN_DAYS : offer.trialDays;
  const started = new Date();
  const ends = addDays(started, days);
  const startedAt = started.toISOString();
  const endsAt = ends.toISOString();

  const withStart = await ctx.supabaseAdmin
    .from('profiles')
    .update({
      membership_tier: 'premium',
      trial_started_at: startedAt,
      trial_ends_at: endsAt,
    })
    .eq('id', ctx.userId)
    .is('trial_ends_at', null)
    .select('id, trial_started_at, trial_ends_at')
    .maybeSingle();

  let saved = withStart.data;
  let error = withStart.error;

  if (missingStartColumn(error)) {
    const withoutStart = await ctx.supabaseAdmin
      .from('profiles')
      .update({
        membership_tier: 'premium',
        trial_ends_at: endsAt,
      })
      .eq('id', ctx.userId)
      .is('trial_ends_at', null)
      .select('id, trial_ends_at')
      .maybeSingle();
    saved = withoutStart.data
      ? { id: withoutStart.data.id, trial_started_at: startedAt, trial_ends_at: withoutStart.data.trial_ends_at }
      : null;
    error = withoutStart.error;
  }

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: remoteStart ? 'Could not record the 120-day start.' : 'Could not record the Early Bird date.',
    });
  }

  if (!saved) {
    const current = await readEarlyBirdOffer(ctx.supabaseAdmin, ctx.userId);
    if (current.trialEndsAt && Date.parse(current.trialEndsAt) > Date.now()) {
      await pinClaimMetro(ctx.supabaseAdmin, ctx.userId);
      return {
        trialStartedAt: current.trialStartedAt,
        trialEndsAt: current.trialEndsAt,
        trialDays: days,
        alreadyStarted: true,
        remoteKitchen: remoteStart,
      };
    }
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: remoteStart
        ? 'The 120 days are not available for this account.'
        : 'Early Bird is not available for this account.',
    });
  }

  console.log(
    `[EarlyBird] PlateMaker ${ctx.userId} started ${startedAt} ends ${endsAt} days ${days} remote ${remoteStart}`,
  );
  if (!remoteStart) await pinClaimMetro(ctx.supabaseAdmin, ctx.userId);

  return {
    trialStartedAt: startedAt,
    trialEndsAt: endsAt,
    trialDays: days,
    alreadyStarted: false,
    remoteKitchen: remoteStart,
  };
});
