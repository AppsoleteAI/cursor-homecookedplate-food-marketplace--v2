import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/hooks/auth-context';
import { readDeviceCoordinates } from '@/lib/device-coordinates';
import { trpc } from '@/lib/trpc';

const CHECK_MS = 5 * 60 * 1000;

/** Reads GPS while the app is open. A different metro is saved only after more than 30 minutes there. */
export function MetroStayWatch() {
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();
  const locate = trpc.membership.locate.useMutation();
  const locateRef = useRef(locate.mutateAsync);
  locateRef.current = locate.mutateAsync;
  const running = useRef(false);
  const asked = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      if (running.current || AppState.currentState !== 'active') return;
      running.current = true;
      try {
        const read = await readDeviceCoordinates(!asked.current);
        asked.current = true;
        if (read.status !== 'ready') return;
        const found = await locateRef.current({ ...read.point, mode: 'visit' });
        if (found.reason !== 'waiting' && found.metroArea && found.metroArea !== user.metroArea) {
          await utils.auth.me.invalidate();
        }
      } catch {
        // A missed check leaves the saved metro in place.
      } finally {
        running.current = false;
      }
    };

    check();
    timer = setInterval(check, CHECK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [isAuthenticated, user?.id, user?.metroArea, utils.auth.me]);

  return null;
}
