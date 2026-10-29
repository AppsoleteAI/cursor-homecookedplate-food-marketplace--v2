import { distanceMeters } from './metro-radius';

/** 20 miles. A plate is offered only inside this distance from the cook's saved pin. */
export const PICKUP_RADIUS_METERS = 32_187;

export type MapPin = {
  lat?: number | null;
  lng?: number | null;
};

export function hasMapPin(pin: MapPin | null | undefined): pin is { lat: number; lng: number } {
  return !!pin
    && typeof pin.lat === 'number'
    && Number.isFinite(pin.lat)
    && typeof pin.lng === 'number'
    && Number.isFinite(pin.lng);
}

export function withinPickupRadius(cook: MapPin | null | undefined, buyer: MapPin | null | undefined): boolean {
  if (!hasMapPin(cook) || !hasMapPin(buyer)) return false;
  return distanceMeters(cook.lat, cook.lng, buyer.lat, buyer.lng) <= PICKUP_RADIUS_METERS;
}
