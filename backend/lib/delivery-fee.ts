import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateDeliveryLevy } from '@/backend/lib/fees';
import type { ShopFulfillment } from '@/backend/lib/shop-fulfillment';

const MAX_DELIVERY_FEE = 50;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function normalizeDeliveryFee(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_DELIVERY_FEE) {
    throw new Error(`Delivery fee must be from $0 to $${MAX_DELIVERY_FEE}.`);
  }
  return Math.round(amount * 100) / 100;
}

export function fulfillmentIsDelivery(fulfillment: ShopFulfillment): boolean {
  if (fulfillment.shop === 'meal_prep') return fulfillment.handoff === 'dropoff';
  if (fulfillment.shop === 'farm') return fulfillment.channel === 'hand_delivery' || fulfillment.channel === 'hub_delivery';
  if (fulfillment.shop === 'catering') return true;
  return false;
}

export async function savedDeliveryFee(admin: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await admin
    .from('audit_logs')
    .select('new_data, created_at')
    .eq('user_id', userId)
    .eq('action', 'DELIVERY_FEE')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return 0;
  const amount = Number(asRecord(data[0]?.new_data).amount);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return calculateDeliveryLevy(amount).deliveryFee;
}
