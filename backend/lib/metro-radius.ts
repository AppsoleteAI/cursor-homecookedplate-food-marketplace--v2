/** About 50 miles around each downtown. The nearest center inside this distance wins. */
export const METRO_RADIUS_METERS = 80_000;

export const METRO_CENTERS: { name: string; lat: number; lng: number }[] = [
  { name: 'New York-Newark-Jersey City', lat: 40.7128, lng: -74.006 },
  { name: 'Los Angeles-Long Beach-Anaheim', lat: 34.0522, lng: -118.2437 },
  { name: 'Chicago-Naperville-Elgin', lat: 41.8781, lng: -87.6298 },
  { name: 'Dallas-Fort Worth-Arlington', lat: 32.7767, lng: -96.797 },
  { name: 'Houston-The Woodlands-Sugar Land', lat: 29.7604, lng: -95.3698 },
  { name: 'Washington-Arlington-Alexandria', lat: 38.9072, lng: -77.0369 },
  { name: 'Philadelphia-Camden-Wilmington', lat: 39.9526, lng: -75.1652 },
  { name: 'Miami-Fort Lauderdale-Pompano Beach', lat: 25.7617, lng: -80.1918 },
  { name: 'Atlanta-Sandy Springs-Alpharetta', lat: 33.749, lng: -84.388 },
  { name: 'Boston-Cambridge-Newton', lat: 42.3601, lng: -71.0589 },
  { name: 'Phoenix-Mesa-Chandler', lat: 33.4484, lng: -112.074 },
  { name: 'San Francisco-Oakland-Berkeley', lat: 37.7749, lng: -122.4194 },
  { name: 'Riverside-San Bernardino-Ontario', lat: 33.9806, lng: -117.3755 },
  { name: 'Detroit-Warren-Dearborn', lat: 42.3314, lng: -83.0458 },
  { name: 'Seattle-Tacoma-Bellevue', lat: 47.6062, lng: -122.3321 },
  { name: 'Minneapolis-St. Paul-Bloomington', lat: 44.9778, lng: -93.265 },
  { name: 'San Diego-Chula Vista-Carlsbad', lat: 32.7157, lng: -117.1611 },
  { name: 'Tampa-St. Petersburg-Clearwater', lat: 27.9506, lng: -82.4572 },
  { name: 'Denver-Aurora-Lakewood', lat: 39.7392, lng: -104.9903 },
  { name: 'Baltimore-Columbia-Towson', lat: 39.2904, lng: -76.6122 },
  { name: 'St. Louis', lat: 38.627, lng: -90.1994 },
  { name: 'Orlando-Kissimmee-Sanford', lat: 28.5383, lng: -81.3792 },
  { name: 'Charlotte-Concord-Gastonia', lat: 35.2271, lng: -80.8431 },
  { name: 'San Antonio-New Braunfels', lat: 29.4241, lng: -98.4936 },
  { name: 'Portland-Vancouver-Hillsboro', lat: 45.5152, lng: -122.6784 },
  { name: 'Sacramento-Roseville-Folsom', lat: 38.5816, lng: -121.4944 },
  { name: 'Pittsburgh', lat: 40.440624, lng: -79.995888 },
  { name: 'Austin-Round Rock-Georgetown', lat: 30.2672, lng: -97.7431 },
  { name: 'Las Vegas-Henderson-Paradise', lat: 36.1699, lng: -115.1398 },
  { name: 'Cincinnati', lat: 39.1031, lng: -84.512 },
  { name: 'Kansas City', lat: 39.0997, lng: -94.5786 },
  { name: 'Columbus', lat: 39.9612, lng: -82.9988 },
  { name: 'Indianapolis-Carmel-Anderson', lat: 39.7684, lng: -86.1581 },
  { name: 'Cleveland-Elyria', lat: 41.4993, lng: -81.6944 },
  { name: 'Nashville-Davidson-Murfreesboro-Franklin', lat: 36.1627, lng: -86.7816 },
  { name: 'Virginia Beach-Norfolk-Newport News', lat: 36.8529, lng: -75.978 },
  { name: 'Providence-Warwick', lat: 41.824, lng: -71.4128 },
  { name: 'Jacksonville', lat: 30.3322, lng: -81.6557 },
  { name: 'Milwaukee-Waukesha', lat: 43.0389, lng: -87.9065 },
  { name: 'Oklahoma City', lat: 35.4676, lng: -97.5164 },
  { name: 'Raleigh-Cary', lat: 35.7796, lng: -78.6382 },
  { name: 'Memphis', lat: 35.1495, lng: -90.049 },
  { name: 'Richmond', lat: 37.5407, lng: -77.436 },
  { name: 'Louisville/Jefferson County', lat: 38.2527, lng: -85.7585 },
  { name: 'New Orleans-Metairie', lat: 29.9511, lng: -90.0715 },
  { name: 'Salt Lake City', lat: 40.7608, lng: -111.891 },
  { name: 'Hartford-West Hartford-East Hartford', lat: 41.7658, lng: -72.6734 },
  { name: 'Buffalo-Cheektowaga', lat: 42.8864, lng: -78.8784 },
  { name: 'Birmingham-Hoover', lat: 33.5207, lng: -86.8025 },
  { name: 'Rochester', lat: 43.1566, lng: -77.6088 },
];

export function distanceMeters(lat: number, lng: number, otherLat: number, otherLng: number): number {
  const earth = 6_371_000;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(otherLat - lat);
  const dLng = toRad(otherLng - lng);
  const start = toRad(lat);
  const end = toRad(otherLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(start) * Math.cos(end) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isKnownMetro(name: string | null | undefined): boolean {
  return !!name && METRO_CENTERS.some((metro) => metro.name === name);
}

/** The closest downtown inside the shared radius, or null when the point is outside all 50. */
export function nearestMetro(lat: number, lng: number): { name: string; distanceMeters: number } | null {
  let best: { name: string; distanceMeters: number } | null = null;
  for (const metro of METRO_CENTERS) {
    const meters = distanceMeters(lat, lng, metro.lat, metro.lng);
    if (meters > METRO_RADIUS_METERS) continue;
    if (!best || meters < best.distanceMeters) best = { name: metro.name, distanceMeters: meters };
  }
  return best;
}
