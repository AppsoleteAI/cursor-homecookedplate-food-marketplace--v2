import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';
import { accountAllowsSignIn } from '@/backend/lib/legal-gate';

export type FirstAction = 'order' | 'publish';
export type FirstRole = 'platetaker' | 'platemaker';
export type FirstStep = 'legal' | 'location' | 'brief' | 'ready';

const BRIEF_KEY = 'hcp_first_action_brief';

export function firstActionRole(action: FirstAction): FirstRole {
  return action === 'publish' ? 'platemaker' : 'platetaker';
}

export function firstActionDestination(action: FirstAction): Href {
  return action === 'publish' ? '/publish-plate' : '/checkout';
}

/** A saved agreement is the nine sections and the date. */
export function firstLegalReady(agreement: unknown, createdAt: Date | null): boolean {
  if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
  return accountAllowsSignIn(agreement, createdAt);
}

/** A named metro, including Remote, means Find My Location already saved this place. */
export function firstLocationReady(metroArea: string | null | undefined): boolean {
  return typeof metroArea === 'string' && metroArea.length > 0;
}

export function nextFirstStep(input: {
  legalReady: boolean;
  locationReady: boolean;
  briefReady: boolean;
}): FirstStep {
  if (!input.legalReady) return 'legal';
  if (!input.locationReady) return 'location';
  if (!input.briefReady) return 'brief';
  return 'ready';
}

export function firstStepHref(step: Exclude<FirstStep, 'ready'>, action: FirstAction): Href {
  const role = firstActionRole(action);
  if (step === 'legal') {
    return { pathname: '/legal', params: { entry: 'first-action', action } } as Href;
  }
  if (step === 'location') {
    return { pathname: '/(auth)/onboarding', params: { entry: 'first-action', action, step: '0', role } } as Href;
  }
  return { pathname: '/(auth)/welcome', params: { entry: 'first-action', action, step: '3', role } } as Href;
}

function briefStorageKey(userId: string, action: FirstAction): string {
  return `${BRIEF_KEY}:${userId}:${action}`;
}

export async function readBriefReady(userId: string, action: FirstAction): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(briefStorageKey(userId, action))) === '1';
  } catch {
    return false;
  }
}

export async function markBriefReady(userId: string, action: FirstAction): Promise<void> {
  await AsyncStorage.setItem(briefStorageKey(userId, action), '1');
}
