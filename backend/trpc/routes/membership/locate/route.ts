import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { saveEarlyBirdClaim } from '../../../../lib/early-bird-claim';
import { readEarlyBirdOffer } from '../../../../lib/early-bird';
import { moveMetroHeadcount, namedMetro, undoMetroHeadcount } from '../../../../lib/metro-headcount';
import { nearestMetro } from '../../../../lib/metro-radius';
import { stayClockRestarts, stayIsReady } from '../../../../lib/metro-stay';
import { protectedProcedure } from '../../../create-context';

type MetroSettings = {
  metro_name: string;
  is_active?: boolean;
  trial_days?: number;
};

type Admin = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

function metroNameFrom(data: unknown): string | null {
  if (typeof data === 'string' && data.trim()) return data.trim();
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const name = record.metro_name ?? record.metroName;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

function settingsFrom(data: unknown): MetroSettings | null {
  const row = Array.isArray(data) ? data[0] : data;
  const name = metroNameFrom(row);
  if (!name || !row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  return {
    metro_name: name,
    is_active: typeof record.is_active === 'boolean' ? record.is_active : undefined,
    trial_days: typeof record.trial_days === 'number' ? record.trial_days : undefined,
  };
}

async function lookupMetro(admin: Admin, lat: number, lng: number): Promise<{ settings: MetroSettings | null; error: string | null }> {
  const nearest = nearestMetro(lat, lng);
  if (!nearest) return { settings: null, error: null };
  const { data, error } = await admin
    .from('metro_geofences')
    .select('metro_name, is_active, trial_days')
    .eq('metro_name', nearest.name)
    .maybeSingle();
  if (error) return { settings: null, error: error.message || 'Could not read this metro.' };
  const saved = settingsFrom(data);
  if (saved) return { settings: saved, error: null };
  return { settings: { metro_name: nearest.name, is_active: true, trial_days: 90 }, error: null };
}

export const locateMembershipProcedure = protectedProcedure
  .input(z.object({
    lat: z.number(),
    lng: z.number(),
    mode: z.enum(['commit', 'visit']).default('commit'),
  }))
  .mutation(async ({ ctx, input }) => {
    const { data: profile, error } = await ctx.supabaseAdmin
      .from('profiles')
      .select('id, role, metro_area, trial_ends_at')
      .eq('id', ctx.userId)
      .single();

    if (error || !profile) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
    }

    const lookedUp = await lookupMetro(ctx.supabaseAdmin, input.lat, input.lng);
    const metro = lookedUp.settings;
    console.log(`[Locate] ${input.lat}, ${input.lng} -> ${metro?.metro_name || lookedUp.error || 'outside'}`);

    if (!metro) {
      if (input.mode === 'visit' && !lookedUp.error) {
        const current = profile.metro_area || 'Remote/Other';
        const visited = await noteMetroVisit(
          ctx.supabaseAdmin,
          ctx.userId,
          profile.role,
          profile.trial_ends_at,
          current,
          'Remote/Other',
        );
        const offer = await readEarlyBirdOffer(ctx.supabaseAdmin, ctx.userId);
        return {
          metroArea: visited.metroArea,
          earlyBirdEligible: offer.eligible,
          trialDays: offer.eligible ? offer.trialDays : 0,
          lat: input.lat,
          lng: input.lng,
          reason: visited.committed ? 'in_metro' as const : 'waiting' as const,
          committed: visited.committed,
        };
      }
      return {
        metroArea: profile.metro_area || 'Remote/Other',
        earlyBirdEligible: false,
        trialDays: 0,
        lat: input.lat,
        lng: input.lng,
        reason: lookedUp.error ? 'lookup_failed' as const : 'outside' as const,
      };
    }

    if (metro.is_active === false) {
      return {
        metroArea: profile.metro_area || 'Remote/Other',
        earlyBirdEligible: false,
        trialDays: 0,
        lat: input.lat,
        lng: input.lng,
        reason: 'paused' as const,
      };
    }

    const current = profile.metro_area || 'Remote/Other';
    if (input.mode === 'visit') {
      const visited = await noteMetroVisit(
        ctx.supabaseAdmin,
        ctx.userId,
        profile.role,
        profile.trial_ends_at,
        current,
        metro.metro_name,
      );
      const offer = await readEarlyBirdOffer(ctx.supabaseAdmin, ctx.userId);
      return {
        metroArea: visited.metroArea,
        earlyBirdEligible: offer.eligible,
        trialDays: offer.eligible ? offer.trialDays : 0,
        lat: input.lat,
        lng: input.lng,
        reason: visited.committed ? 'in_metro' as const : 'waiting' as const,
        committed: visited.committed,
      };
    }

    if (current !== metro.metro_name) {
      let headcount: { blocked: boolean };
      try {
        headcount = await moveMetroHeadcount(ctx.supabaseAdmin, profile.role, current, metro.metro_name);
      } catch {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Could not save this metro.' });
      }
      if (headcount.blocked) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This metro is full.' });
      }
      const leaving = namedMetro(current);
      if (profile.trial_ends_at && leaving) {
        await saveEarlyBirdClaim(ctx.supabaseAdmin, ctx.userId, leaving);
      }

      const { error: updateError } = await ctx.supabaseAdmin
        .from('profiles')
        .update({ metro_area: metro.metro_name })
        .eq('id', ctx.userId);
      if (updateError) {
        await undoMetroHeadcount(ctx.supabaseAdmin, profile.role, current, metro.metro_name);
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Could not save this metro.' });
      }
    }

    const offer = await readEarlyBirdOffer(ctx.supabaseAdmin, ctx.userId);
    return {
      metroArea: metro.metro_name,
      earlyBirdEligible: offer.eligible,
      trialDays: offer.eligible ? offer.trialDays : 0,
      lat: input.lat,
      lng: input.lng,
      reason: offer.eligible ? 'eligible' as const : 'in_metro' as const,
    };
  });

async function noteMetroVisit(
  admin: Admin,
  userId: string,
  role: string | null,
  trialEndsAt: string | null,
  current: string,
  seen: string,
): Promise<{ metroArea: string; committed: boolean }> {
  const now = new Date();
  const { data } = await admin
    .from('audit_logs')
    .select('new_data')
    .eq('user_id', userId)
    .eq('action', 'METRO_STAY')
    .order('created_at', { ascending: false })
    .limit(1);
  const stored = data?.[0]?.new_data as { metroName?: string; startedAt?: string; lastSeenAt?: string } | null;
  const writeStay = (metroName: string, startedAt: string) => admin.from('audit_logs').insert({
    user_id: userId,
    action: 'METRO_STAY',
    table_name: 'profiles',
    new_data: { metroName, startedAt, lastSeenAt: now.toISOString() },
  });
  if (seen === current) {
    if (stored?.metroName && stored.metroName !== current) {
      await writeStay(current, now.toISOString());
    }
    return { metroArea: current, committed: false };
  }

  const sameCircle = stored?.metroName === seen && typeof stored.startedAt === 'string';
  if (!sameCircle || stayClockRestarts(stored?.lastSeenAt, now.getTime())) {
    await writeStay(seen, now.toISOString());
    return { metroArea: current, committed: false };
  }

  if (!stayIsReady(stored?.startedAt, now.getTime())) {
    await writeStay(seen, stored?.startedAt || now.toISOString());
    return { metroArea: current, committed: false };
  }

  let headcount: { blocked: boolean };
  try {
    headcount = await moveMetroHeadcount(admin, role, current, seen);
  } catch {
    return { metroArea: current, committed: false };
  }
  if (headcount.blocked) return { metroArea: current, committed: false };
  const leaving = namedMetro(current);
  if (trialEndsAt && leaving) await saveEarlyBirdClaim(admin, userId, leaving);
  const saved = await admin.from('profiles').update({ metro_area: seen }).eq('id', userId);
  if (saved.error) {
    await undoMetroHeadcount(admin, role, current, seen);
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Could not save this metro.' });
  }
  await writeStay(seen, now.toISOString());
  return { metroArea: seen, committed: true };
}
