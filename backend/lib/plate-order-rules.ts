import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { chargedPlateBase, plateTotalsMatch } from './fees';
import { confirmedPaidIds } from './order-payment';
import { orderColumnsAfterError, orderTotal } from './order-row';
import { loadActiveOffers } from './active-offer';
import { isSampleMealId } from '@/lib/sample-meals';
import { cookPermitIsSaved } from './kitchen-permit';
import { assertBuyerCanOrder } from './buyer-order-access';
import { salesVolumeBlock } from './stripe-marketplace';
import { savedDeliveryFee } from './delivery-fee';
import { cookTimeZoneFromTags, pickupFitsWindow, pickupWindowNeedsCookZone, portionRowHolds, portionsFromTags } from '@/lib/meal-publish';
import { pickupGate } from './kitchen-pin';
import { buyerMetroCanOrder } from './metro-menu';
import { auditTextField, auditTextList } from './text-audit';

type Admin = SupabaseClient;

async function portionRows(admin: { from: (table: string) => any }, mealId: string) {
  let columns = 'id, quantity, status, paid, payment_intent_id, created_at';
  let result = await admin.from('orders').select(columns).eq('meal_id', mealId);
  for (let attempt = 0; attempt < 4 && result.error; attempt += 1) {
    const next = orderColumnsAfterError(columns, result.error.message);
    if (!next) return null;
    columns = next;
    result = await admin.from('orders').select(columns).eq('meal_id', mealId);
  }
  if (result.error) return null;
  const rows = (result.data || []) as { id: string; paid?: boolean | null; payment_intent_id?: string | null; quantity?: number; status?: string; created_at?: string }[];
  if (columns.split(', ').includes('paid')) return rows;
  const paidIds = await confirmedPaidIds(rows, admin, undefined);
  return rows.map((row) => ({ ...row, paid: paidIds.has(row.id) }));
}

export async function portionsAlreadyTaken(admin: { from: (table: string) => any }, mealId: string): Promise<number | null> {
  const data = await portionRows(admin, mealId);
  if (!data) return null;
  return data.reduce((sum, row) => {
    if (!portionRowHolds(row)) return sum;
    return sum + Math.max(0, Math.round(Number(row.quantity) || 0));
  }, 0);
}

export async function thisOrderExceedsPortions(
  admin: { from: (table: string) => any },
  mealId: string,
  orderId: string,
  portionCap: number,
): Promise<boolean | null> {
  const data = await portionRows(admin, mealId);
  if (!data) return null;
  const rows = data
    .filter((row) => portionRowHolds(row))
    .sort((a, b) => {
      const byTime = String(a.created_at || '').localeCompare(String(b.created_at || ''));
      return byTime === 0 ? a.id.localeCompare(b.id) : byTime;
    });
  let sum = 0;
  for (const row of rows) {
    sum += Math.max(0, Math.round(Number(row.quantity) || 0));
    if (row.id === orderId) return sum > portionCap;
  }
  return false;
}

function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

async function readStoredBase(admin: Admin, orderId: string): Promise<number | null> {
  const full = await admin.from('orders').select('total_price, total_price_cents').eq('id', orderId).maybeSingle();
  if (!full.error && full.data) return orderTotal(full.data);
  const price = await admin.from('orders').select('total_price').eq('id', orderId).maybeSingle();
  if (!price.error && price.data) return orderTotal(price.data);
  const cents = await admin.from('orders').select('total_price_cents').eq('id', orderId).maybeSingle();
  if (!cents.error && cents.data) return orderTotal(cents.data);
  return null;
}

/**
 * The insert trigger can replace a sale with the list price.
 * Write the offer total back. A later status change does not reprice the order.
 */
export async function holdChargedBase(admin: Admin, orderId: string, chargedBase: number): Promise<number | null> {
  const stored = await readStoredBase(admin, orderId);
  if (plateTotalsMatch(stored, chargedBase)) return stored;
  const cents = Math.round(chargedBase * 100);
  let write = await admin.from('orders').update({ total_price: chargedBase, total_price_cents: cents }).eq('id', orderId);
  if (write.error && /total_price_cents/i.test(write.error.message || '')) {
    write = await admin.from('orders').update({ total_price: chargedBase }).eq('id', orderId);
  } else if (write.error && /total_price/i.test(write.error.message || '')) {
    write = await admin.from('orders').update({ total_price_cents: cents }).eq('id', orderId);
  }
  if (write.error) return stored;
  return readStoredBase(admin, orderId);
}

export type PreparedHomePlate = {
  mealName: string;
  quantity: number;
  chargedBase: number;
  pickupTime: string;
  pickupTimeZone: string | null;
  instructions: string;
  deliveryAddress: string | null;
  cookingTemperature: string | null;
  allergies: string[];
  portionCap: number;
};

/** The same plate rules as plate checkout: menu, pickup window, portions, offer price, and delivery. */
export async function prepareHomePlate(
  admin: Admin,
  input: {
    buyerId: string;
    sellerId: string;
    mealId: string;
    quantity: number;
    pickupTime?: string | null;
    pickupTimeZone?: string | null;
    specialInstructions?: string | null;
    deliveryAddress?: string | null;
    cookingTemperature?: string | null;
    allergies?: string[] | null;
    reservePortions?: boolean;
  },
): Promise<PreparedHomePlate> {
  if (isSampleMealId(input.mealId)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sample plates are not for sale.' });
  }

  const { data: sellerProfile, error: sellerError } = await admin
    .from('profiles')
    .select('role, available_for_orders, metro_area, is_paused, selling_removed')
    .eq('id', input.sellerId)
    .maybeSingle();
  if (sellerError || !sellerProfile) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Seller profile not found' });
  }
  if (sellerProfile.role !== 'platemaker') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid seller account' });
  }
  if (sellerProfile.available_for_orders !== true) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This platemaker is currently not accepting new orders' });
  }
  if (sellerProfile.is_paused === true) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This cook has paused their account.' });
  }
  if (sellerProfile.selling_removed) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'This cook is not allowed to take new orders' });
  }
  if (!(await cookPermitIsSaved(admin, input.sellerId))) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'That plate is not on the menu.' });
  }

  await assertBuyerCanOrder(admin, input.buyerId, input.sellerId);

  const gate = await pickupGate(admin, input.buyerId, [input.sellerId]);
  if (gate.mode === 'distance') {
    if (!gate.ok) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: gate.message });
    }
  } else {
    const buyerMetro = await admin.from('profiles').select('metro_area').eq('id', input.buyerId).maybeSingle();
    if (buyerMetro.error) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Your saved metro could not be checked. The order was not placed.' });
    }
    const buyerArea = typeof buyerMetro.data?.metro_area === 'string' ? buyerMetro.data.metro_area : '';
    if (!buyerMetroCanOrder(sellerProfile.metro_area, buyerArea)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: buyerArea.trim()
          ? 'This plate is outside your saved metro.'
          : 'Save your metro before ordering a plate.',
      });
    }
  }

  const { data: mealRow, error: mealError } = await admin
    .from('meals')
    .select('id, name, price, user_id, published, available, tags')
    .eq('id', input.mealId)
    .maybeSingle();
  if (mealError || !mealRow) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'That plate is not on the menu.' });
  }
  if (mealRow.user_id !== input.sellerId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'That plate is not sold by this cook.' });
  }
  if (mealRow.published !== true || mealRow.available === false) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'That plate is not on the menu.' });
  }

  const pickupAt = new Date(input.pickupTime || '');
  if (!input.pickupTime || Number.isNaN(pickupAt.getTime()) || pickupAt.getTime() < Date.now() - 60_000) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose a pickup time that has not passed.' });
  }
  const pickupTimeZone = input.pickupTimeZone && isTimeZone(input.pickupTimeZone) ? input.pickupTimeZone : null;
  if (pickupWindowNeedsCookZone(mealRow.tags)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This plate has no cook time zone yet.' });
  }
  if (!pickupFitsWindow(mealRow.tags, pickupAt, cookTimeZoneFromTags(mealRow.tags))) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Choose a pickup time on a day and hour this plate is offered.' });
  }

  const quantity = Math.round(input.quantity);
  const portionCap = portionsFromTags(mealRow.tags);
  if (input.reservePortions !== false) {
    const taken = await portionsAlreadyTaken(admin, input.mealId);
    if (taken == null) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Portions for this plate could not be counted. The order was not placed.' });
    }
    if (taken + quantity > portionCap) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Those portions are already taken.' });
    }
  }

  let address = (input.deliveryAddress || '').trim();
  if (address) {
    const scannedAddress = await auditTextField(admin, input.buyerId, 'delivery_address', address);
    if (scannedAddress.blocked) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That delivery address cannot be saved.' });
    }
    address = scannedAddress.value;
  }
  if (address && address.length < 8) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Enter the delivery address.' });
  }
  if (address && !((await savedDeliveryFee(admin, input.sellerId)) > 0)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'This cook has not set a delivery fee, so delivery cannot be selected.',
    });
  }

  const menuPrice = parseFloat(String(mealRow.price));
  const offer = (await loadActiveOffers(admin, [input.mealId])).get(input.mealId) ?? null;
  const chargedBase = chargedPlateBase(menuPrice, quantity, offer);
  if (!(chargedBase > 0)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'This offer takes the price to zero. Use a smaller discount.' });
  }
  const freeItem = offer?.type === 'free-item' && offer.freeItemName
    ? `Free item: ${offer.freeItemName}`
    : '';
  let note = '';
  if (input.specialInstructions && input.specialInstructions.trim()) {
    const scanned = await auditTextField(admin, input.buyerId, 'special_instructions', input.specialInstructions);
    if (scanned.blocked) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That note cannot be saved.' });
    }
    note = scanned.value;
  }
  let cookingTemperature: string | null = null;
  if (input.cookingTemperature && input.cookingTemperature.trim()) {
    const scanned = await auditTextField(admin, input.buyerId, 'cooking_temperature', input.cookingTemperature);
    if (scanned.blocked) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That cooking note cannot be saved.' });
    }
    cookingTemperature = scanned.value || null;
  }
  let allergies: string[] = [];
  if (input.allergies && input.allergies.length > 0) {
    const scanned = await auditTextList(admin, input.buyerId, 'allergies', input.allergies);
    if (scanned.blocked) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That allergy note cannot be saved.' });
    }
    allergies = scanned.values.filter((item) => item.length > 0);
  }
  const volumeBlock = await salesVolumeBlock(admin, input.sellerId, chargedBase);
  if (volumeBlock) {
    throw new TRPCError({ code: 'FORBIDDEN', message: volumeBlock });
  }

  return {
    mealName: String(mealRow.name || 'Plate'),
    quantity,
    chargedBase,
    pickupTime: input.pickupTime,
    pickupTimeZone,
    instructions: [note, freeItem].filter(Boolean).join('\n'),
    deliveryAddress: address || null,
    cookingTemperature,
    allergies,
    portionCap,
  };
}
