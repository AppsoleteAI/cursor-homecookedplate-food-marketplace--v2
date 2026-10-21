import { useEffect } from 'react';
import { useAuth } from '@/hooks/auth-context';
import { trpc, trpcProxyClient } from '@/lib/trpc';

export type SharedLane = 'farm' | 'meal_prep' | 'food_truck' | 'catering' | 'sit_down';

export function shareLaneListing(lane: SharedLane, listing: { id: string }) {
  trpcProxyClient.lanes.save.mutate({ lane, listing }).catch(() => undefined);
}

export function mergeSharedListings<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const seen = new Set(local.map((item) => item.id));
  const extra = remote.filter((item) => item.id && !seen.has(item.id));
  if (extra.length === 0) return local;
  return [...extra, ...local];
}

export function useSharedLaneListings<T extends { id: string }>(
  lane: SharedLane,
  current: T[],
  apply: (listings: T[]) => void,
) {
  const { user } = useAuth();
  const shared = trpc.lanes.list.useQuery(
    { lane, metroArea: user?.metroArea || undefined },
    { retry: false, refetchOnWindowFocus: false },
  );
  useEffect(() => {
    if (!shared.data) return;
    const remote = (shared.data as unknown as T[]).filter((row) => typeof row?.id === 'string');
    const merged = mergeSharedListings(current, remote);
    if (merged.length !== current.length) apply(merged);
  }, [apply, current, lane, shared.data]);
}
