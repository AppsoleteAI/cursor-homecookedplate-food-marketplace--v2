import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../create-context';
import { offerFromRow } from '../../../lib/active-offer';
import { MAX_AMOUNT_OFF, MAX_PERCENT_OFF, type PromotionPrice } from '../../../lib/fees';
import { OFFER_AREAS } from '../../../lib/gift-areas';
import { sanitizeTextField } from '../../../lib/text-security';

const offerInput = z.object({
  id: z.string().uuid().optional(),
  area: z.enum(OFFER_AREAS),
  listingId: z.string().min(1).max(80),
  type: z.enum(['percentage', 'buy-x-get-y', 'fixed-amount', 'free-item']),
  title: z.string().min(1).max(80),
  description: z.string().min(1).max(280),
  discountPercentage: z.number().positive().max(MAX_PERCENT_OFF).optional(),
  discountAmount: z.number().positive().max(MAX_AMOUNT_OFF).optional(),
  buyQuantity: z.number().int().positive().max(20).optional(),
  getQuantity: z.number().int().positive().max(20).optional(),
  freeItemName: z.string().max(80).optional(),
  startDate: z.string().min(8),
  endDate: z.string().min(8),
  isActive: z.boolean().default(true),
});

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || error.code === '42P01' || /area_offers/i.test(error.message ?? '') || /schema cache/i.test(error.message ?? '');
}

function present(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    area: String(row.area),
    listingId: String(row.listing_id),
    type: row.type as PromotionPrice['type'],
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    discountPercentage: (row.discount_percentage as number | null) ?? null,
    discountAmount: (row.discount_amount as number | null) ?? null,
    buyQuantity: (row.buy_quantity as number | null) ?? null,
    getQuantity: (row.get_quantity as number | null) ?? null,
    freeItemName: (row.free_item_name as string | null) ?? null,
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    isActive: row.is_active !== false,
    createdAt: String(row.created_at ?? row.start_date),
  };
}

export const listMyLaneItemsProcedure = protectedProcedure
  .input(z.object({ area: z.enum(OFFER_AREAS) }))
  .query(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabaseAdmin
      .from('lane_listings')
      .select('id, listing')
      .eq('seller_id', ctx.userId)
      .eq('lane', input.area)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01' || /lane_listings/i.test(error.message ?? '') || /schema cache/i.test(error.message ?? '')) return [];
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Your items could not be loaded.' });
    }
    return (data || []).flatMap((row: { id: string; listing: unknown }) => {
      if (!row.listing || typeof row.listing !== 'object') return [];
      const listing = row.listing as { name?: string; price?: number; pricePerPerson?: number };
      const price = typeof listing.price === 'number' ? listing.price : listing.pricePerPerson;
      return [{ id: row.id, name: listing.name || 'Item', price: typeof price === 'number' ? price : null }];
    });
  });

export const listMyAreaOffersProcedure = protectedProcedure
  .input(z.object({ area: z.enum(OFFER_AREAS) }))
  .query(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabaseAdmin
      .from('area_offers')
      .select('*')
      .eq('user_id', ctx.userId)
      .eq('area', input.area)
      .order('created_at', { ascending: false });
    if (error) {
      if (missingTable(error)) return [];
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Offers could not be loaded.' });
    }
    return (data || []).map((row) => present(row));
  });

export const offersForListingsProcedure = protectedProcedure
  .input(z.object({
    area: z.enum(OFFER_AREAS),
    listingIds: z.array(z.string().min(1).max(80)).max(20),
  }))
  .query(async ({ input, ctx }) => {
    if (input.listingIds.length === 0) return {} as Record<string, PromotionPrice>;
    const { data, error } = await ctx.supabaseAdmin
      .from('area_offers')
      .select('id, listing_id, type, title, description, discount_percentage, discount_amount, buy_quantity, get_quantity, free_item_name, start_date, end_date, is_active')
      .eq('area', input.area)
      .in('listing_id', input.listingIds)
      .eq('is_active', true)
      .order('start_date', { ascending: false });
    if (error) {
      if (missingTable(error)) return {} as Record<string, PromotionPrice>;
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Offers could not be loaded.' });
    }
    const offers: Record<string, PromotionPrice> = {};
    for (const row of data || []) {
      const offer = offerFromRow({ ...row, meal_id: row.listing_id });
      if (!offer || offers[offer.mealId]) continue;
      offers[offer.mealId] = {
        type: offer.type,
        discountPercentage: offer.discountPercentage,
        discountAmount: offer.discountAmount,
        buyQuantity: offer.buyQuantity,
        getQuantity: offer.getQuantity,
      };
    }
    return offers;
  });

export const saveAreaOfferProcedure = protectedProcedure
  .input(offerInput)
  .mutation(async ({ input, ctx }) => {
    const profile = await ctx.supabaseAdmin.from('profiles').select('role').eq('id', ctx.userId).maybeSingle();
    if (profile.data?.role !== 'platemaker') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only a PlateMaker can set an offer.' });
    }
    const title = sanitizeTextField(input.title);
    const description = sanitizeTextField(input.description);
    const freeItem = input.freeItemName ? sanitizeTextField(input.freeItemName) : null;
    if (title.blocked || description.blocked || freeItem?.blocked) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That offer text is not allowed.' });
    }
    const start = Date.parse(input.startDate);
    const end = Date.parse(input.endDate);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'The end date has to be on or after the start date.' });
    }
    if (input.type === 'percentage' && !(Number(input.discountPercentage) >= 1 && Number(input.discountPercentage) <= MAX_PERCENT_OFF)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Percentage off is 1 to 50.' });
    }
    if (input.type === 'fixed-amount' && !(Number(input.discountAmount) > 0 && Number(input.discountAmount) <= MAX_AMOUNT_OFF)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Amount off is at most $100.' });
    }
    if (input.type === 'buy-x-get-y' && (!(Number(input.buyQuantity) > 0) || !(Number(input.getQuantity) > 0))) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enter how many are paid and how many are free.' });
    }
    if (input.type === 'free-item' && !freeItem?.value) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Name the free item.' });
    }

    const listing = await ctx.supabaseAdmin
      .from('lane_listings')
      .select('id, seller_id, lane')
      .eq('id', input.listingId)
      .maybeSingle();
    if (listing.error || !listing.data || listing.data.seller_id !== ctx.userId || listing.data.lane !== input.area) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Choose one of your items in this area.' });
    }

    const row = {
      user_id: ctx.userId,
      area: input.area,
      listing_id: input.listingId,
      type: input.type,
      title: title.value,
      description: description.value,
      discount_percentage: input.type === 'percentage' ? input.discountPercentage : null,
      discount_amount: input.type === 'fixed-amount' ? input.discountAmount : null,
      buy_quantity: input.type === 'buy-x-get-y' ? input.buyQuantity : null,
      get_quantity: input.type === 'buy-x-get-y' ? input.getQuantity : null,
      free_item_name: input.type === 'free-item' ? freeItem?.value ?? null : null,
      start_date: new Date(start).toISOString(),
      end_date: new Date(end).toISOString(),
      is_active: input.isActive,
    };
    const write = input.id
      ? ctx.supabaseAdmin.from('area_offers').update(row).eq('id', input.id).eq('user_id', ctx.userId).select('*').single()
      : ctx.supabaseAdmin.from('area_offers').insert(row).select('*').single();
    const { data, error } = await write;
    if (error || !data) {
      if (missingTable(error)) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Area offers are not on this kitchen yet.' });
      }
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error?.message || 'The offer could not be saved.' });
    }
    return present(data);
  });

export const deleteAreaOfferProcedure = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    const { error } = await ctx.supabaseAdmin
      .from('area_offers')
      .delete()
      .eq('id', input.id)
      .eq('user_id', ctx.userId);
    if (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The offer could not be deleted.' });
    }
    return { id: input.id };
  });
