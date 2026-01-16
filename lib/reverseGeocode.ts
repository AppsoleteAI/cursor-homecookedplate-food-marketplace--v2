/**
 * @deprecated This file uses OpenStreetMap Nominatim API, which violates RORK_INSTRUCTIONS.md Section 2 (GEOFENCING).
 * 
 * All geocoding should use PostGIS RPC function `find_metro_by_location` via backend tRPC routes.
 * Users are "locked" to their metro_area at signup, so frontend geocoding is no longer needed.
 * 
 * This file is kept for backward compatibility only. Do not import or use these functions.
 * 
 * Migration:
 * - Use `profiles.metro_area` from user session/profile instead of geocoding
 * - For new geocoding needs, create a backend tRPC route that calls PostGIS RPC
 */

import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';

// Import metro list from backend (we'll share it between frontend and backend)
// For now, duplicating it here to avoid cross-references
const MAJOR_METROS = [
  "New York-Newark-Jersey City",
  "Los Angeles-Long Beach-Anaheim",
  "Chicago-Naperville-Elgin",
  "Dallas-Fort Worth-Arlington",
  "Houston-The Woodlands-Sugar Land",
  "Washington-Arlington-Alexandria",
  "Philadelphia-Camden-Wilmington",
  "Miami-Fort Lauderdale-Pompano Beach",
  "Atlanta-Sandy Springs-Alpharetta",
  "Boston-Cambridge-Newton",
  "Phoenix-Mesa-Chandler",
  "San Francisco-Oakland-Berkeley",
  "Riverside-San Bernardino-Ontario",
  "Detroit-Warren-Dearborn",
  "Seattle-Tacoma-Bellevue",
  "Minneapolis-St. Paul-Bloomington",
  "San Diego-Chula Vista-Carlsbad",
  "Tampa-St. Petersburg-Clearwater",
  "Denver-Aurora-Lakewood",
  "Baltimore-Columbia-Towson",
  "St. Louis",
  "Orlando-Kissimmee-Sanford",
  "Charlotte-Concord-Gastonia",
  "San Antonio-New Braunfels",
  "Portland-Vancouver-Hillsboro",
  "Sacramento-Roseville-Folsom",
  "Pittsburgh",
  "Austin-Round Rock-Georgetown",
  "Las Vegas-Henderson-Paradise",
  "Cincinnati",
  "Kansas City",
  "Columbus",
  "Indianapolis-Carmel-Anderson",
  "Cleveland-Elyria",
  "Nashville-Davidson-Murfreesboro-Franklin",
  "Virginia Beach-Norfolk-Newport News",
  "Providence-Warwick",
  "Jacksonville",
  "Milwaukee-Waukesha",
  "Oklahoma City",
  "Raleigh-Cary",
  "Memphis",
  "Richmond",
  "Louisville/Jefferson County",
  "New Orleans-Metairie",
  "Salt Lake City",
  "Hartford-West Hartford-East Hartford",
  "Buffalo-Cheektowaga",
  "Birmingham-Hoover",
  "Rochester"
];

export interface ReverseGeocodeResult {
  success: boolean;
  metroName: string | null;
  address?: string;
  error?: string;
}

/**
 * Extract metro area from OpenStreetMap address object
 * Tries multiple address fields to find metro name
 */
function extractMetroFromAddress(address: any): string | null {
  if (!address) return null;

  // Try different address fields that might contain metro area
  const fieldsToCheck = [
    address.metropolitan_area,
    address.city_district,
    address.city,
    address.town,
    address.village,
    address.county,
    address.state_district,
    address.region,
  ].filter(Boolean);

  // Check if any field matches our metro list
  for (const field of fieldsToCheck) {
    const fieldLower = field.toLowerCase();
    
    for (const metro of MAJOR_METROS) {
      // Case-insensitive matching - check if field contains metro name or vice versa
      if (
        fieldLower.includes(metro.toLowerCase()) ||
        metro.toLowerCase().includes(fieldLower)
      ) {
        return metro;
      }
    }
  }

  // If no exact match, try constructing metro from city + state
  // (e.g., "New York, NY" -> "New York-Newark-Jersey City")
  const city = address.city || address.town || address.village;
  const state = address.state;
  
  if (city && state) {
    const cityStateLower = `${city}, ${state}`.toLowerCase();
    
    for (const metro of MAJOR_METROS) {
      if (metro.toLowerCase().includes(cityStateLower.split(',')[0]) ||
          cityStateLower.includes(metro.toLowerCase().split('-')[0])) {
        return metro;
      }
    }
  }

  return null;
}

/**
 * Reverse geocode GPS coordinates to metro area using OpenStreetMap Nominatim API
 * @param latitude - GPS latitude
 * @param longitude - GPS longitude
 * @returns Metro name if found, null otherwise
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  try {
    // OpenStreetMap Nominatim API (free, no API key required)
    // Note: Nominatim requires a User-Agent header
    const userAgent = 'HomeCookedPlate/1.0 (https://homecookedplate.com)';
    
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=10`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        metroName: null,
        error: `Geocoding API error: ${response.status}`,
      };
    }

    const data = await response.json();
    
    if (!data.address) {
      return {
        success: false,
        metroName: null,
        error: 'No address found for coordinates',
      };
    }

    const metroName = extractMetroFromAddress(data.address);
    const displayAddress = data.display_name || 'Unknown location';

    return {
      success: true,
      metroName,
      address: displayAddress,
    };
  } catch (error) {
    console.error('[Reverse Geocode] Error:', error);
    return {
      success: false,
      metroName: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get current location and reverse geocode to metro area
 * @returns Metro name if detected and eligible, null otherwise
 */
export async function getCurrentMetroArea(): Promise<ReverseGeocodeResult> {
  try {
    // Check if location services are available
    if (Platform.OS === 'web') {
      return {
        success: false,
        metroName: null,
        error: 'Location services not available on web',
      };
    }

    // Request location permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      return {
        success: false,
        metroName: null,
        error: 'Location permission denied',
      };
    }

    // Get current position
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced, // Balanced accuracy is sufficient for metro area
    });

    // Reverse geocode
    return await reverseGeocode(
      location.coords.latitude,
      location.coords.longitude
    );
  } catch (error) {
    console.error('[Get Current Metro] Error:', error);
    return {
      success: false,
      metroName: null,
      error: error instanceof Error ? error.message : 'Failed to get location',
    };
  }
}

/**
 * Simple string matching fallback (for profile location or manual input)
 * Matches location string against metro list
 */
export function matchMetroFromString(location: string | null | undefined): string | null {
  if (!location) return null;

  const locationLower = location.toLowerCase();
  
  for (const metro of MAJOR_METROS) {
    // Case-insensitive partial matching
    if (
      locationLower.includes(metro.toLowerCase()) ||
      metro.toLowerCase().includes(locationLower)
    ) {
      return metro;
    }
  }

  return null;
}
