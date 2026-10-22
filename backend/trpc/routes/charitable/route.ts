import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../create-context';
import { producedCost } from '../../../lib/fees';
import { GIFT_AREAS, RECIPIENTS } from '../../../lib/gift-areas';
import { mealVisibleInMetro } from '../../../lib/metro-menu';
import { sanitizeTextField } from '../../../lib/text-security';

const giftInput = z.object({
  area: z.enum(GIFT_AREAS),
  itemName: z.string().min(2).max(80),
  quantity: z.number().int().positive().max(500),
  recipient: z.enum(RECIPIENTS),
  producedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ingredientCost: z.number().min(0).max(10000),
  packagingCost: z.number().min(0).max(10000),
});

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || error.code === '42P01' || /charitable_gifts/i.test(error.message ?? '') || /schema cache/i.test(error.message ?? '');
}

type GiftRow = {
  id: string;
  cook_id: string;
  area: string;
  item_name: string;
  quantity: number;
  quantity_claimed: number;
  recipient: string;
  produced_on: string;
  ingredient_cost: number;
  packaging_cost: number;
  created_at: string;
};

function present(row: GiftRow, viewerId: string, cookName: string) {
  const remaining = Math.max(0, Number(row.quantity) - Number(row.quantity_claimed));
  const own = row.cook_id === viewerId;
  const cost = own ? producedCost(Number(row.ingredient_cost), Number(row.packaging_cost)) : null;
  return {
    id: row.id,
    cookId: row.cook_id,
    cookName,
    area: row.area,
    itemName: row.item_name,
    quantity: Number(row.quantity),
    quantityClaimed: Number(row.quantity_claimed),
    remaining,
    recipient: row.recipient,
    producedOn: row.produced_on,
    createdAt: row.created_at,
    ingredientCost: own ? Number(row.ingredient_cost) : null,
    packagingCost: own ? Number(row.packaging_cost) : null,
    producedCost: cost,
  };
}

async function cookNames(admin: { from: (table: string) => any }, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map<string, { name: string; metro: string | null }>();
  const { data } = await admin.from('profiles').select('id, username, metro_area').in('id', unique);
  return new Map<string, { name: string; metro: string | null }>(
    (data || []).map((row: { id: string; username?: string | null; metro_area?: string | null }) => [
      row.id,
      { name: row.username || 'Cook', metro: row.metro_area ?? null },
    ]),
  );
}

export const listOpenGiftsProcedure = protectedProcedure.query(async ({ ctx }) => {
  const viewer = await ctx.supabaseAdmin.from('profiles').select('metro_area').eq('id', ctx.userId).maybeSingle();
  const metro = typeof viewer.data?.metro_area === 'string' ? viewer.data.metro_area : '';
  const { data, error } = await ctx.supabaseAdmin
    .from('charitable_gifts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) {
    if (missingTable(error)) return [];
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Gifts could not be loaded.' });
  }
  const rows = (data || []) as GiftRow[];
  const names = await cookNames(ctx.supabaseAdmin, rows.map((row) => row.cook_id));
  return rows.flatMap((row) => {
    const cook = names.get(row.cook_id);
    if (!mealVisibleInMetro(cook?.metro, metro || undefined)) return [];
    const gift = present(row, ctx.userId, cook?.name || 'Cook');
    if (gift.remaining < 1) return [];
    return [gift];
  });
});

export const listMyGiftsProcedure = protectedProcedure.query(async ({ ctx }) => {
  const { data, error } = await ctx.supabaseAdmin
    .from('charitable_gifts')
    .select('*')
    .eq('cook_id', ctx.userId)
    .order('created_at', { ascending: false });
  if (error) {
    if (missingTable(error)) return [];
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Your gift register could not be loaded.' });
  }
  const profile = await ctx.supabaseAdmin.from('profiles').select('username').eq('id', ctx.userId).maybeSingle();
  const name = profile.data?.username || 'Cook';
  return ((data || []) as GiftRow[]).map((row) => present(row, ctx.userId, name));
});

export const saveGiftProcedure = protectedProcedure
  .input(giftInput)
  .mutation(async ({ input, ctx }) => {
    const profile = await ctx.supabaseAdmin.from('profiles').select('role, username').eq('id', ctx.userId).maybeSingle();
    if (profile.data?.role !== 'platemaker') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Only a PlateMaker can set aside a gift.' });
    }
    const item = sanitizeTextField(input.itemName);
    if (item.blocked || !item.value) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Name the food.' });
    }
    const produced = Date.parse(`${input.producedOn}T00:00:00Z`);
    if (!Number.isFinite(produced) || produced > Date.now() + 24 * 60 * 60 * 1000) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'The date has to be today or earlier.' });
    }
    const cost = producedCost(input.ingredientCost, input.packagingCost);
    const { data, error } = await ctx.supabaseAdmin
      .from('charitable_gifts')
      .insert({
        cook_id: ctx.userId,
        area: input.area,
        item_name: item.value,
        quantity: input.quantity,
        quantity_claimed: 0,
        recipient: input.recipient,
        produced_on: input.producedOn,
        ingredient_cost: input.ingredientCost,
        packaging_cost: input.packagingCost,
      })
      .select('*')
      .single();
    if (error || !data) {
      if (missingTable(error)) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The gift register is not on this kitchen yet.' });
      }
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error?.message || 'The gift could not be saved.' });
    }
    const saved = present(data as GiftRow, ctx.userId, profile.data?.username || 'Cook');
    return { ...saved, producedCost: cost };
  });

export const claimGiftProcedure = protectedProcedure
  .input(z.object({
    giftId: z.string().uuid(),
    quantity: z.number().int().positive().max(500),
  }))
  .mutation(async ({ input, ctx }) => {
    const profile = await ctx.supabaseAdmin.from('profiles').select('role').eq('id', ctx.userId).maybeSingle();
    if (profile.data?.role !== 'platetaker') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'A PlateTaker claims a portion. No card is charged.' });
    }
    const existing = await ctx.supabaseAdmin.from('charitable_gifts').select('*').eq('id', input.giftId).maybeSingle();
    if (existing.error || !existing.data) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'That gift is not on the register.' });
    }
    const gift = existing.data as GiftRow;
    if (gift.cook_id === ctx.userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'A cook does not claim their own gift.' });
    }
    const remaining = Number(gift.quantity) - Number(gift.quantity_claimed);
    if (input.quantity > remaining) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Those portions are already taken.' });
    }
    const nextClaimed = Number(gift.quantity_claimed) + input.quantity;
    const updated = await ctx.supabaseAdmin
      .from('charitable_gifts')
      .update({ quantity_claimed: nextClaimed })
      .eq('id', gift.id)
      .eq('quantity_claimed', gift.quantity_claimed)
      .select('id')
      .maybeSingle();
    if (updated.error || !updated.data) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Those portions are already taken.' });
    }
    const claim = await ctx.supabaseAdmin.from('charitable_claims').insert({
      gift_id: gift.id,
      claimer_id: ctx.userId,
      quantity: input.quantity,
    }).select('id').single();
    if (claim.error || !claim.data) {
      await ctx.supabaseAdmin
        .from('charitable_gifts')
        .update({ quantity_claimed: gift.quantity_claimed })
        .eq('id', gift.id);
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The portion could not be recorded.' });
    }
    return { giftId: gift.id, quantity: input.quantity, remaining: Number(gift.quantity) - nextClaimed };
  });
