/**
 * Same account, new install: the saved token is replaced.
 * An App Store re-download drops the local token and creates a new one.
 * A blank saved token is the first activation. A matching token is already current.
 * Another account cannot take the token. `profiles.device_id` is unique.
 */
export function lifetimeShouldSaveDevice(savedDeviceId: string | null | undefined, deviceId: string): boolean {
  const saved = (savedDeviceId || '').trim();
  return saved.length > 0 && saved !== deviceId.trim();
}
