import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/auth-context';
import { trpc } from '@/lib/trpc';
import {
  firstLegalReady,
  firstLocationReady,
  firstStepHref,
  nextFirstStep,
  readBriefReady,
  type FirstAction,
} from '@/lib/first-action';

/** Sends the first order or the first plate through the page, the location, and the role notes. */
export function useFirstActionRedirect(action: FirstAction) {
  const { user } = useAuth();
  const me = trpc.auth.me.useQuery(undefined, { enabled: Boolean(user?.id), retry: false });
  const userId = user?.id;

  useEffect(() => {
    if (!userId || !me.data || me.data.id !== userId) return;
    let live = true;
    const created = me.data.createdAt ? new Date(me.data.createdAt) : null;
    readBriefReady(userId, action).then((briefReady) => {
      if (!live) return;
      const step = nextFirstStep({
        legalReady: firstLegalReady(me.data?.legalSafetyAgreement, created),
        locationReady: firstLocationReady(me.data?.metroArea),
        briefReady,
      });
      if (step === 'ready') return;
      router.replace(firstStepHref(step, action));
    }).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [action, me.data, userId]);
}

