import { TRPCError } from '@trpc/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function assertBuyerCanOrder(
  admin: SupabaseClient,
  buyerId: string,
  sellerId?: string,
): Promise<void> {
  const { data: buyer } = await admin
    .from('profiles')
    .select('ordering_removed')
    .eq('id', buyerId)
    .maybeSingle();

  if (buyer?.ordering_removed) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This account is permanently banned after lost card disputes.',
    });
  }

  if (!sellerId) return;

  const { data: block } = await admin
    .from('cook_buyer_blocks')
    .select('id')
    .eq('platemaker_id', sellerId)
    .eq('platetaker_id', buyerId)
    .maybeSingle();

  if (block?.id) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This cook is not taking orders from this account.',
    });
  }
}
