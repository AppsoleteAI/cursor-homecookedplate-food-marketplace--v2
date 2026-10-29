import { distanceMeters } from '../metro-radius';
import { cookReachesBuyer } from '../metro-menu';
import { PICKUP_RADIUS_METERS, withinPickupRadius } from '../pickup-radius';
import { canStartRemoteKitchen, REMOTE_KITCHEN_DAYS } from '../remote-kitchen';

describe('20-mile pickup', () => {
  const cook = { lat: 40.440624, lng: -79.995888 };
  const nearby = { lat: 40.5, lng: -80.0 };
  const far = { lat: 25.7617, lng: -80.1918 };

  it('uses 20 miles', () => {
    expect(PICKUP_RADIUS_METERS).toBe(32_187);
    expect(withinPickupRadius(cook, nearby)).toBe(true);
    expect(withinPickupRadius(cook, far)).toBe(false);
    expect(distanceMeters(cook.lat, cook.lng, far.lat, far.lng)).toBeGreaterThan(PICKUP_RADIUS_METERS);
  });

  it('hides a Remote cook from a Remote buyer outside 20 miles once pins exist', () => {
    expect(cookReachesBuyer({
      pinsReady: true,
      cookPin: cook,
      buyerPin: far,
      cookMetro: 'Remote/Other',
      buyerMetro: 'Remote/Other',
    })).toBe(false);
    expect(cookReachesBuyer({
      pinsReady: false,
      cookPin: cook,
      buyerPin: far,
      cookMetro: 'Remote/Other',
      buyerMetro: 'Remote/Other',
    })).toBe(true);
  });

  it('shows a plate across the 50-mile edge when the buyer is inside 20 miles', () => {
    expect(cookReachesBuyer({
      pinsReady: true,
      cookPin: cook,
      buyerPin: nearby,
      cookMetro: 'Pittsburgh',
      buyerMetro: 'Remote/Other',
    })).toBe(true);
  });
});

describe('Remote kitchen period', () => {
  it('offers 120 days only to an unpaid Remote PlateMaker who has not started', () => {
    expect(REMOTE_KITCHEN_DAYS).toBe(120);
    expect(canStartRemoteKitchen({
      role: 'platemaker',
      metroArea: 'Remote/Other',
      paid: false,
      trialEndsAt: null,
    })).toBe(true);
    expect(canStartRemoteKitchen({
      role: 'platetaker',
      metroArea: 'Remote/Other',
      paid: false,
      trialEndsAt: null,
    })).toBe(false);
    expect(canStartRemoteKitchen({
      role: 'platemaker',
      metroArea: 'Pittsburgh',
      paid: false,
      trialEndsAt: null,
    })).toBe(false);
    expect(canStartRemoteKitchen({
      role: 'platemaker',
      metroArea: 'Remote/Other',
      paid: false,
      trialEndsAt: '2026-12-01T00:00:00.000Z',
    })).toBe(false);
  });
});
