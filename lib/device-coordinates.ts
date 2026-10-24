import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { fixAgeMs, fixQuality, normalizeUsPoint, type FixQuality } from '@/lib/location-fix';

export type DevicePoint = { lat: number; lng: number };

export type DeviceRead =
  | { status: 'ready'; point: DevicePoint }
  | { status: 'denied' | 'imprecise' | 'unavailable' };

const TAP_WAIT_MS = 20_000;
const PASSIVE_WAIT_MS = 12_000;
const HOLD_MS = 1_500;

type Sample = {
  lat: number;
  lng: number;
  accuracy: number;
  quality: FixQuality;
};

function sampleFrom(latitude: number, longitude: number, accuracy: number | null | undefined, timestamp: number): Sample | null {
  const point = normalizeUsPoint(latitude, longitude);
  const quality = fixQuality({
    lat: point.lat,
    lng: point.lng,
    accuracy,
    ageMs: fixAgeMs(timestamp),
  });
  if (quality === 'reject' || typeof accuracy !== 'number') return null;
  return { lat: point.lat, lng: point.lng, accuracy, quality };
}

function better(next: Sample, current: Sample | null): boolean {
  if (!current) return true;
  return next.accuracy < current.accuracy;
}

async function permissionState(ask: boolean): Promise<'granted' | 'denied' | 'coarse'> {
  let response = await Location.getForegroundPermissionsAsync();
  if (response.status !== 'granted') {
    if (!ask) return 'denied';
    response = await Location.requestForegroundPermissionsAsync();
  }
  if (response.status !== 'granted') return 'denied';
  if (response.android?.accuracy === 'coarse') {
    if (!ask) return 'coarse';
    const again = await Location.requestForegroundPermissionsAsync();
    if (again.status !== 'granted') return 'denied';
    if (again.android?.accuracy === 'coarse') return 'coarse';
  }
  return 'granted';
}

function watchFreshPoint(waitMs: number): Promise<Sample | 'imprecise' | 'unavailable'> {
  return new Promise((resolve) => {
    let best: Sample | null = null;
    let subscription: Location.LocationSubscription | null = null;
    let settled = false;
    let watchFailed = false;
    let currentFailed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hold: ReturnType<typeof setTimeout> | null = null;
    const started = Date.now();
    const finish = (value: Sample | 'imprecise' | 'unavailable') => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (hold) clearTimeout(hold);
      subscription?.remove();
      resolve(value);
    };
    const giveUp = () => {
      if (watchFailed && currentFailed && !best) finish('unavailable');
    };
    const consider = (latitude: number, longitude: number, accuracy: number | null | undefined, timestamp: number) => {
      const next = sampleFrom(latitude, longitude, accuracy, timestamp);
      if (!next) return;
      if (better(next, best)) best = next;
      if (best?.quality === 'precise' && Date.now() - started >= HOLD_MS) finish(best);
    };
    hold = setTimeout(() => {
      if (best?.quality === 'precise') finish(best);
    }, HOLD_MS);
    timer = setTimeout(() => {
      if (best) finish(best);
      else finish(watchFailed && currentFailed ? 'unavailable' : 'imprecise');
    }, waitMs);
    const accuracy = Location.Accuracy.BestForNavigation ?? Location.Accuracy.Highest ?? Location.Accuracy.High;
    const options = {
      accuracy,
      timeInterval: 1000,
      distanceInterval: 0,
      mayShowUserSettingsDialog: true,
    };
    Location.watchPositionAsync(options, (location) => {
      consider(location.coords.latitude, location.coords.longitude, location.coords.accuracy, location.timestamp);
    }).then((next) => {
      if (settled) next.remove();
      else subscription = next;
    }).catch(() => {
      watchFailed = true;
      giveUp();
    });
    Location.getCurrentPositionAsync(options).then((location) => {
      consider(location.coords.latitude, location.coords.longitude, location.coords.accuracy, location.timestamp);
    }).catch(() => {
      currentFailed = true;
      giveUp();
    });
  });
}

async function readWebPoint(ask: boolean): Promise<DeviceRead> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return { status: 'unavailable' };
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: ask ? TAP_WAIT_MS : PASSIVE_WAIT_MS,
        maximumAge: 0,
      });
    });
    const sample = sampleFrom(
      position.coords.latitude,
      position.coords.longitude,
      position.coords.accuracy,
      position.timestamp,
    );
    if (!sample) return { status: 'imprecise' };
    return { status: 'ready', point: { lat: sample.lat, lng: sample.lng } };
  } catch (error) {
    const denied = typeof error === 'object' && error !== null && 'code' in error && (error as { code?: number }).code === 1;
    return { status: denied ? 'denied' : 'unavailable' };
  }
}

/** A fresh device point. `ask` shows the permission prompt. A coarse or cached point is not returned. */
export async function readDeviceCoordinates(ask: boolean): Promise<DeviceRead> {
  if (Platform.OS === 'web') return readWebPoint(ask);
  try {
    const permission = await permissionState(ask);
    if (permission === 'denied') return { status: 'denied' };
    if (permission === 'coarse') return { status: 'imprecise' };
    const sample = await watchFreshPoint(ask ? TAP_WAIT_MS : PASSIVE_WAIT_MS);
    if (sample === 'imprecise' || sample === 'unavailable') return { status: sample };
    return { status: 'ready', point: { lat: sample.lat, lng: sample.lng } };
  } catch {
    return { status: 'unavailable' };
  }
}
