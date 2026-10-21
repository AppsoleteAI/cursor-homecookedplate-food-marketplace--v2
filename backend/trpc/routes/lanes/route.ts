import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, publicProcedure } from '../../create-context';
import { mealVisibleInMetro } from '../../../lib/metro-menu';

const LANES = ['farm', 'meal_prep', 'food_truck', 'catering', 'sit_down'] as const;

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || error.code === '42P01' || /lane_listings/i.test(error.message ?? '') || /schema cache/i.test(error.message ?? '');
}

export const listLaneListingsProcedure = publicProcedure
  .input(z.object({ lane: z.enum(LANES), metroArea: z.string().optional() }))
  .query(async ({ input, ctx }) => {
    const profile = ctx.userId
      ? await ctx.supabaseAdmin.from('profiles').select('metro_area').eq('id', ctx.userId).maybeSingle()
      : { data: null };
    const savedMetro = typeof profile.data?.metro_area === 'string' ? profile.data.metro_area.trim() : '';
    const { data, error } = await ctx.supabaseAdmin
      .from('lane_listings')
      .select('id, seller_id, listing')
      .eq('lane', input.lane)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      if (missingTable(error)) return [];
      console.error('[LaneListings] List failed:', error.message);
      return [];
    }
    const sellerIds = [...new Set((data || []).map((row: { seller_id: string }) => row.seller_id).filter(Boolean))];
    const metros = sellerIds.length === 0
      ? { data: [] as { id: string; metro_area: string | null }[] }
      : await ctx.supabaseAdmin.from('profiles').select('id, metro_area').in('id', sellerIds);
    const cookMetros = new Map<string, string | null>(
      (metros.data || []).map((row: { id: string; metro_area: string | null }) => [row.id, row.metro_area])
    );
    return (data || []).flatMap((row: { id: string; seller_id: string; listing: unknown }) => {
      if (!row.listing || typeof row.listing !== 'object') return [];
      if (!mealVisibleInMetro(cookMetros.get(row.seller_id), savedMetro || undefined)) return [];
      return [{ ...(row.listing as Record<string, unknown>), id: row.id, sellerId: row.seller_id }];
    });
  });

export const saveLaneListingProcedure = protectedProcedure
  .input(z.object({
    lane: z.enum(LANES),
    listing: z.record(z.string(), z.unknown()),
  }))
  .mutation(async ({ input, ctx }) => {
    const id = typeof input.listing.id === 'string' && input.listing.id.length > 0 && input.listing.id.length <= 80
      ? input.listing.id
      : `${input.lane}-${Date.now()}`;
    const { error } = await ctx.supabaseAdmin
      .from('lane_listings')
      .upsert({
        id,
        lane: input.lane,
        seller_id: ctx.userId,
        listing: { ...input.listing, id },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
    if (error) {
      if (missingTable(error)) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Shared listings are not on this kitchen yet. This one stays on this phone.' });
      }
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The listing could not be shared.' });
    }
    return { id };
  });
