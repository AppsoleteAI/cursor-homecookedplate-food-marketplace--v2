/** A signed-in lifetime account may use this device. A different saved token is replaced. */
export function lifetimeShouldSaveDevice(savedDeviceId: string | null | undefined, deviceId: string): boolean {
  const saved = (savedDeviceId || '').trim();
  return saved.length > 0 && saved !== deviceId.trim();
}
