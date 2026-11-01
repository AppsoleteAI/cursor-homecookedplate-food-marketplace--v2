/**
 * Live metro_geofences stores the city in name.
 * The repo schema uses metro_name. Reads and writes try metro_name, then name.
 */

type GeofenceClient = { from: (table: string) => any };

export type GeofenceSettings = {
  metro_name: string;
  is_active: boolean;
  trial_days: number;
};

export function missingGeofenceNameColumn(message: string | undefined): boolean {
  return typeof message === 'string' && /column/i.test(message) && /metro_name/.test(message);
}

function settingsFrom(row: { metro_name?: string | null; name?: string | null; is_active?: boolean | null; trial_days?: number | null }, fallback: string): GeofenceSettings {
  return {
    metro_name: row.metro_name || row.name || fallback,
    is_active: row.is_active !== false,
    trial_days: typeof row.trial_days === 'number' && row.trial_days > 0 ? row.trial_days : 90,
  };
}

export async function readGeofenceSettings(
  admin: GeofenceClient,
  metroName: string,
): Promise<{ settings: GeofenceSettings | null; error: string | null }> {
  const byMetroName = await admin
    .from('metro_geofences')
    .select('metro_name, is_active, trial_days')
    .eq('metro_name', metroName)
    .maybeSingle();
  if (!byMetroName.error) {
    if (!byMetroName.data) return { settings: null, error: null };
    return { settings: settingsFrom(byMetroName.data, metroName), error: null };
  }
  if (!missingGeofenceNameColumn(byMetroName.error.message)) {
    return { settings: null, error: byMetroName.error.message || 'Could not read metro settings' };
  }

  const byName = await admin
    .from('metro_geofences')
    .select('name, is_active, trial_days')
    .eq('name', metroName)
    .maybeSingle();
  if (byName.error) {
    return { settings: null, error: byName.error.message || 'Could not read metro settings' };
  }
  if (!byName.data) return { settings: null, error: null };
  return { settings: settingsFrom(byName.data, metroName), error: null };
}

export async function updateGeofenceSettings(
  admin: GeofenceClient,
  metroName: string,
  patch: { is_active?: boolean; trial_days?: number; updated_at?: string },
): Promise<{ data: GeofenceSettings & { updated_at?: string } | null; error: { message?: string } | null }> {
  const byMetroName = await admin
    .from('metro_geofences')
    .update(patch)
    .eq('metro_name', metroName)
    .select('metro_name, is_active, trial_days, updated_at')
    .maybeSingle();
  if (!byMetroName.error) {
    return {
      data: byMetroName.data ? { ...settingsFrom(byMetroName.data, metroName), updated_at: byMetroName.data.updated_at } : null,
      error: null,
    };
  }
  if (!missingGeofenceNameColumn(byMetroName.error.message)) {
    return { data: null, error: byMetroName.error };
  }

  const byName = await admin
    .from('metro_geofences')
    .update(patch)
    .eq('name', metroName)
    .select('name, is_active, trial_days, updated_at')
    .maybeSingle();
  if (byName.error || !byName.data) return { data: null, error: byName.error };
  return {
    data: { ...settingsFrom(byName.data, metroName), updated_at: byName.data.updated_at },
    error: null,
  };
}

export async function setAllGeofencesActive(
  admin: GeofenceClient,
  active: boolean,
): Promise<{ count: number; error: { message?: string } | null }> {
  const patch = { is_active: active, updated_at: new Date().toISOString() };
  const byMetroName = await admin.from('metro_geofences').update(patch).select('metro_name');
  if (!byMetroName.error) {
    return { count: byMetroName.data?.length || 0, error: null };
  }
  if (!missingGeofenceNameColumn(byMetroName.error.message)) {
    return { count: 0, error: byMetroName.error };
  }
  const byName = await admin.from('metro_geofences').update(patch).select('name');
  if (byName.error) return { count: 0, error: byName.error };
  return { count: byName.data?.length || 0, error: null };
}
