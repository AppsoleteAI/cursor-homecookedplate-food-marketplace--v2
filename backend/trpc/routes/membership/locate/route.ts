import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { readEarlyBirdOffer } from '../../../../lib/early-bird';
import { nearestMetro } from '../../../../lib/metro-radius';
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

async function settingsForName(admin: Admin, metroName: string): Promise<MetroSettings | null> {
  const { data, error } = await admin
    .from('metro_geofences')
    .select('metro_name, is_active, trial_days')
    .eq('metro_name', metroName)
    .maybeSingle();
  if (error || !data) return null;
  return settingsFrom(data);
}

async function lookupMetro(admin: Admin, lat: number, lng: number): Promise<{ settings: MetroSettings | null; error: string | null }> {
  const settingsCall = await admin.rpc('get_metro_settings_by_location', { lat, lng });
  const settings = settingsFrom(settingsCall.data);
  if (settings) return { settings, error: null };

  const findCall = await admin.rpc('find_metro_by_location', { lng, lat });
  const foundName = metroNameFrom(findCall.data);
  if (foundName) {
    const saved = await settingsForName(admin, foundName);
    if (saved) return { settings: saved, error: null };
  }

  const swapped = await admin.rpc('find_metro_by_location', { lng: lat, lat: lng });
  const swappedName = metroNameFrom(swapped.data);
  if (swappedName) {
    const saved = await settingsForName(admin, swappedName);
    if (saved) return { settings: saved, error: null };
  }

  const nearest = nearestMetro(lat, lng);
  if (nearest) {
    const saved = await settingsForName(admin, nearest.name);
    if (saved) return { settings: saved, error: null };
    return { settings: { metro_name: nearest.name, is_active: true, trial_days: 90 }, error: null };
  }

  const error = settingsCall.error?.message || findCall.error?.message || swapped.error?.message || null;
  return { settings: null, error };
}

export const locateMembershipProcedure = protectedProcedure
  .input(z.object({
    lat: z.number(),
    lng: z.number(),
  }))
  .mutation(async ({ ctx, input }) => {
    const { data: profile, error } = await ctx.supabaseAdmin
      .from('profiles')
      .select('id, role, metro_area')
      .eq('id', ctx.userId)
      .single();

    if (error || !profile) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
    }

    const lookedUp = await lookupMetro(ctx.supabaseAdmin, input.lat, input.lng);
    const metro = lookedUp.settings;
    console.log(`[Locate] ${input.lat}, ${input.lng} -> ${metro?.metro_name || lookedUp.error || 'outside'}`);

    if (!metro) {
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
    if (current !== metro.metro_name) {
      if (current === 'Remote/Other') {
        const { error: incrementError } = await ctx.supabaseAdmin.rpc('increment_metro_count', {
          metro_name_param: metro.metro_name,
          user_role: profile.role || 'platetaker',
        });
        if (incrementError) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not save this metro.' });
        }
      }

      const { error: updateError } = await ctx.supabaseAdmin
        .from('profiles')
        .update({ metro_area: metro.metro_name })
        .eq('id', ctx.userId);
      if (updateError) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not save this metro.' });
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
