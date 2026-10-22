import { useMemo } from 'react';
import { promotionalBase } from '@/backend/lib/fees';
import type { OfferArea } from '@/backend/lib/gift-areas';
import { trpc } from '@/lib/trpc';

export function useAreaOfferTotal(
  area: OfferArea,
  lines: { id: string; unitPrice: number; quantity: number }[],
) {
  const listingKey = lines.map((line) => line.id).join('|');
  const listingIds = useMemo(() => [...new Set(listingKey.split('|').filter(Boolean))], [listingKey]);
  const offers = trpc.areaOffers.forListings.useQuery(
    { area, listingIds },
    { enabled: listingIds.length > 0, retry: false },
  );
  const baseAmount = lines.reduce((sum, line) => {
    const quantity = Math.max(1, Math.round(line.quantity));
    return sum + promotionalBase(line.unitPrice, quantity, offers.data?.[line.id] ?? null);
  }, 0);
  return { baseAmount, loading: listingIds.length > 0 && offers.isLoading };
}
