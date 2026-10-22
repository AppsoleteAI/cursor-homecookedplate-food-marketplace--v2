import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../create-context';
import { missingOffersTable, offerFromRow, type StoredOffer } from '../../../lib/active-offer';
import { MAX_AMOUNT_OFF, MAX_PERCENT_OFF } from '../../../lib/fees';
import { sanitizeTextField } from '../../../lib/text-security';

const offerInput = z.object({
  id: z.string().uuid().optional(),
  mealId: z.string().uuid(),
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

function present(row: Parameters<typeof offerFromRow>[0] & { is_active?: boolean | null; created_at?: string }): StoredOffer & { createdAt: string } {
  const current = offerFromRow({ ...row, is_active: true }) ?? {
    id: row.id,
    mealId: row.meal_id,
    type: row.type,
    title: row.title,
    description: row.description,
    discountPercentage: row.discount_percentage,
    discountAmount: row.discount_amount,
    buyQuantity: row.buy_quantity,
    getQuantity: row.get_quantity,
    freeItemName: row.free_item_name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active !== false,
  };
  return { ...current, isActive: row.is_active !== false, createdAt: row.created_at ?? row.start_date };
}

export const listMyPromotionsProcedure = protectedProcedure.query(async ({ ctx }) => {
  const { data, error } = await ctx.supabase
    .from('promotional_offers')
    .select('*')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false });
  if (error) {
    if (missingOffersTable(error)) return [];
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Promotions could not be loaded.' });
  }
  return (data || []).map((row) => present(row));
});

export const savePromotionProcedure = protectedProcedure
  .input(offerInput)
  .mutation(async ({ input, ctx }) => {
    const title = sanitizeTextField(input.title);
    const description = sanitizeTextField(input.description);
    const freeItem = input.freeItemName ? sanitizeTextField(input.freeItemName) : null;
    if (title.blocked || description.blocked || freeItem?.blocked) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That promotion text is not allowed.' });
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

    const { data: meal, error: mealError } = await ctx.supabase
      .from('meals')
      .select('id, user_id')
      .eq('id', input.mealId)
      .maybeSingle();
    if (mealError || !meal || meal.user_id !== ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Choose one of your plates for this promotion.' });
    }

    const row = {
      meal_id: input.mealId,
      user_id: ctx.userId,
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
      ? ctx.supabase.from('promotional_offers').update(row).eq('id', input.id).eq('user_id', ctx.userId).select('*').single()
      : ctx.supabase.from('promotional_offers').insert(row).select('*').single();
    const { data, error } = await write;
    if (error || !data) {
      if (missingOffersTable(error)) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Promotions are not available on this kitchen yet.' });
      }
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error?.message || 'The promotion could not be saved.' });
    }
    return present(data);
  });

export const deletePromotionProcedure = protectedProcedure
  .input(z.object({ id: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    const { error } = await ctx.supabase
      .from('promotional_offers')
      .delete()
      .eq('id', input.id)
      .eq('user_id', ctx.userId);
    if (error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The promotion could not be deleted.' });
    }
    return { id: input.id };
  });
