import { useCallback, useEffect, useRef } from 'react';
import { Alert, BackHandler, Platform } from 'react-native';
import { router, useLocalSearchParams, useNavigation, type Href } from 'expo-router';
import { StackActions, useIsFocused } from '@react-navigation/native';

type Nav = {
  getState?: () => { type?: string; index?: number; routes?: { name?: string }[] };
  dispatch?: (action: unknown) => void;
  getParent?: () => Nav | undefined;
};

function safePath(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

function canPop(navigation: Nav): boolean {
  let current: Nav | undefined = navigation;
  const seen = new Set<Nav>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const state = current.getState?.();
    if (state?.type === 'stack' && typeof state.index === 'number' && state.index > 0 && Array.isArray(state.routes)) {
      const topName = state.routes[state.index]?.name;
      let target = state.index - 1;
      while (target > 0 && state.routes[target]?.name === topName) target -= 1;
      if (state.routes[target]?.name !== topName) return true;
    }
    current = current.getParent?.();
  }
  return false;
}

function popToPrevious(navigation: Nav): boolean {
  let current: Nav | undefined = navigation;
  const seen = new Set<Nav>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const state = current.getState?.();
    if (state?.type === 'stack' && typeof state.index === 'number' && state.index > 0 && Array.isArray(state.routes)) {
      const topName = state.routes[state.index]?.name;
      let target = state.index - 1;
      while (target > 0 && state.routes[target]?.name === topName) target -= 1;
      if (state.routes[target]?.name !== topName && typeof current.dispatch === 'function') {
        current.dispatch(StackActions.pop(state.index - target));
        return true;
      }
    }
    current = current.getParent?.();
  }
  return false;
}

type WebResult = 'ignore' | 'handled' | 'defer';

const webHandlers: (() => WebResult)[] = [];
let restoring = false;
const trail: (string | null)[] = [];
let trailPos = -1;

function historyId(state: unknown): string | null {
  if (state && typeof state === 'object' && 'id' in state && typeof (state as { id: unknown }).id === 'string') {
    return (state as { id: string }).id;
  }
  return null;
}

function noteHistory(kind: 'push' | 'replace' | 'init') {
  const id = historyId(window.history.state);
  if (kind === 'replace' && trailPos >= 0) {
    trail[trailPos] = id;
    return;
  }
  if (kind === 'init') {
    trail.length = 0;
    trail.push(id);
    trailPos = 0;
    return;
  }
  trail.splice(trailPos + 1);
  trail.push(id);
  trailPos = trail.length - 1;
}

function historyDirection(): 'back' | 'forward' | 'unknown' {
  const id = historyId(window.history.state);
  const at = id == null ? -1 : trail.lastIndexOf(id);
  if (at < 0) return 'unknown';
  if (at < trailPos) return 'back';
  if (at > trailPos) return 'forward';
  return 'unknown';
}

function commitTrail() {
  const id = historyId(window.history.state);
  const at = id == null ? -1 : trail.lastIndexOf(id);
  if (at >= 0) trailPos = at;
  else noteHistory('push');
}

function restoreUrl() {
  restoring = true;
  window.history.go(1);
  window.setTimeout(() => {
    restoring = false;
  }, 400);
}

function armTrap(kind: string) {
  const current = window.history.state;
  if (current && typeof current === 'object' && (current as { hcpTrap?: string }).hcpTrap === kind) return;
  const next = current && typeof current === 'object' ? { ...current, hcpTrap: kind } : { hcpTrap: kind };
  window.history.pushState(next, '', window.location.href);
}

function onBrowserPop(event: PopStateEvent) {
  if (restoring) {
    restoring = false;
    commitTrail();
    event.stopImmediatePropagation();
    return;
  }
  const direction = historyDirection();
  commitTrail();
  if (direction === 'forward') return;
  for (let index = webHandlers.length - 1; index >= 0; index -= 1) {
    const result = webHandlers[index]();
    if (result === 'defer') continue;
    if (result === 'handled') event.stopImmediatePropagation();
    return;
  }
}

function installBrowserBack() {
  if (typeof window === 'undefined') return;
  noteHistory('init');
  const push = window.history.pushState.bind(window.history);
  const replace = window.history.replaceState.bind(window.history);
  window.history.pushState = (state, title, url) => {
    push(state, title, url);
    noteHistory('push');
  };
  window.history.replaceState = (state, title, url) => {
    replace(state, title, url);
    noteHistory('replace');
  };
  window.addEventListener('popstate', onBrowserPop, true);
}

if (Platform.OS === 'web' && typeof window !== 'undefined' && !(window as Window & { __hcpBrowserBack?: boolean }).__hcpBrowserBack) {
  (window as Window & { __hcpBrowserBack?: boolean }).__hcpBrowserBack = true;
  installBrowserBack();
}

function useHardware(onPress: () => boolean, enabled: boolean) {
  useEffect(() => {
    if (Platform.OS === 'web' || !enabled) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', onPress);
    return () => subscription.remove();
  }, [onPress, enabled]);
}

function useWebHandler(run: () => WebResult, enabled: boolean) {
  const focused = useIsFocused();
  const runRef = useRef(run);
  const focusedRef = useRef(focused);
  runRef.current = run;
  focusedRef.current = focused;
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const entry = () => (focusedRef.current ? runRef.current() : 'defer');
    webHandlers.push(entry);
    return () => {
      const index = webHandlers.indexOf(entry);
      if (index >= 0) webHandlers.splice(index, 1);
    };
  }, [enabled]);
}

/** Close a dialog, or clear a temporary mode, instead of leaving the screen. */
export function useConsumeBack(onPress: () => void, enabled: boolean) {
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const consume = useCallback(() => {
    if (!enabled) return false;
    onPressRef.current();
    return true;
  }, [enabled]);
  useHardware(consume, enabled);
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    armTrap('consume');
  }, [enabled]);
  useWebHandler(() => {
    if (!enabled) return 'ignore';
    onPressRef.current();
    return 'handled';
  }, enabled);
}

/** Pop to the previous screen. The device back button runs the same action. */
export function useLeaveScreen(fallback?: Href | null, enabled = true) {
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const returnTo = safePath(params.returnTo);

  const leave = useCallback(() => {
    if (!enabled) return false;
    if (returnTo) {
      router.replace(returnTo as Href);
      return true;
    }
    if (popToPrevious(navigation as Nav)) return true;
    if (router.canGoBack()) {
      router.back();
      return true;
    }
    if (fallback) {
      router.replace(fallback);
      return true;
    }
    return false;
  }, [enabled, fallback, navigation, returnTo]);

  useHardware(leave, enabled);
  useWebHandler(() => {
    if (!enabled) return 'ignore';
    if (returnTo) {
      router.replace(returnTo as Href);
      return 'handled';
    }
    if (canPop(navigation as Nav) || router.canGoBack()) return 'ignore';
    if (fallback) {
      router.replace(fallback);
      return 'handled';
    }
    return 'ignore';
  }, enabled);
  return leave;
}

/** Replace with one screen. Does not pop the stack. */
export function useReplaceBack(href: Href, enabled = true) {
  const go = useCallback(() => {
    if (!enabled) return false;
    router.replace(href);
    return true;
  }, [enabled, href]);
  useHardware(go, enabled);
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    armTrap('replace');
  }, [enabled]);
  useWebHandler(() => {
    if (!enabled) return 'ignore';
    router.replace(href);
    return 'handled';
  }, enabled);
  return go;
}

/** Keep the screen. The device back button does not return to the previous page. */
export function useStayBack(enabled = true) {
  const stay = useCallback(() => enabled, [enabled]);
  useHardware(stay, enabled);
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    armTrap('stay');
  }, [enabled]);
  useWebHandler(() => {
    if (!enabled) return 'ignore';
    restoreUrl();
    return 'handled';
  }, enabled);
}

/** Step inside a wizard. Device back moves one step. The first step leaves this screen. */
export function useWizardBack(
  step: number,
  setStep: (updater: (current: number) => number) => void,
  locked = false,
) {
  const navigation = useNavigation();
  const stepRef = useRef(step);
  const lockedRef = useRef(locked);
  const steppedAt = useRef(0);
  const lastStep = useRef(step);
  const fromBrowser = useRef(false);
  const ignoreNextPop = useRef(false);
  stepRef.current = step;
  lockedRef.current = locked;

  const onBack = useCallback(() => {
    if (lockedRef.current || stepRef.current <= 0) return false;
    const now = Date.now();
    if (now - steppedAt.current < 400) return true;
    steppedAt.current = now;
    setStep((current) => Math.max(0, current - 1));
    return true;
  }, [setStep]);
  useHardware(onBack, !locked);
  useEffect(() => {
    if (Platform.OS !== 'web' || locked) return;
    if (step > lastStep.current) {
      const current = window.history.state;
      const next = current && typeof current === 'object' ? { ...current, hcpWizard: step } : { hcpWizard: step };
      window.history.pushState(next, '', window.location.href);
    } else if (step < lastStep.current && !fromBrowser.current) {
      ignoreNextPop.current = true;
      window.history.back();
    }
    fromBrowser.current = false;
    lastStep.current = step;
  }, [step, locked]);
  useWebHandler(() => {
    if (ignoreNextPop.current) {
      ignoreNextPop.current = false;
      return 'handled';
    }
    if (lockedRef.current || stepRef.current <= 0) return 'ignore';
    fromBrowser.current = true;
    setStep((current) => Math.max(0, current - 1));
    return 'handled';
  }, !locked);

  useEffect(() => {
    if (locked) return;
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (lockedRef.current || stepRef.current <= 0) return;
      if (onBack()) event.preventDefault();
    });
    return unsubscribe;
  }, [navigation, onBack, locked]);

  return onBack;
}

const PAID_MESSAGE = 'This order is already paid. Going back does not refund it. Paying again from the previous screen charges the card a second time.';

/** Warn before leaving a paid receipt, then open the orders list. */
export function usePaidBack(ordersHref: Href, enabled: boolean) {
  const leave = useCallback(() => {
    if (!enabled) return false;
    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' && window.confirm(`${PAID_MESSAGE}\n\nLeave this receipt?`);
      if (confirmed) router.replace(ordersHref);
      return true;
    }
    Alert.alert('Already paid', PAID_MESSAGE, [
      { text: 'Stay', style: 'cancel' },
      { text: 'View orders', onPress: () => router.replace(ordersHref) },
    ]);
    return true;
  }, [enabled, ordersHref]);
  useHardware(leave, enabled);
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    armTrap('paid');
  }, [enabled]);
  useWebHandler(() => {
    if (!enabled) return 'ignore';
    const confirmed = typeof window !== 'undefined' && window.confirm(`${PAID_MESSAGE}\n\nLeave this receipt?`);
    if (confirmed) router.replace(ordersHref);
    else restoreUrl();
    return 'handled';
  }, enabled);
  return leave;
}
