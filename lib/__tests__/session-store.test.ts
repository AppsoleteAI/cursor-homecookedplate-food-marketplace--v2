import { chunkedSecureStorage, refreshTokenWasRevoked } from '../session-store';

function memoryStore() {
  const values = new Map<string, string>();
  return {
    values,
    getItemAsync: async (key: string) => values.get(key) ?? null,
    setItemAsync: async (key: string, value: string) => {
      values.set(key, value);
    },
    deleteItemAsync: async (key: string) => {
      values.delete(key);
    },
  };
}

describe.each(['platemaker', 'platetaker'] as const)('one saved session for a %s', () => {
  it('keeps a long session in one value and leaves the previous value when a save fails', async () => {
    const store = memoryStore();
    const storage = chunkedSecureStorage(store);
    await storage.setItem('hcp-auth-session', 'first-session');
    const long = `session-${'a'.repeat(4000)}`;
    await storage.setItem('hcp-auth-session', long);
    expect(await storage.getItem('hcp-auth-session')).toBe(long);

    store.setItemAsync = async () => {
      throw new Error('keychain full');
    };
    await expect(storage.setItem('hcp-auth-session', 'replacement')).rejects.toThrow('keychain full');
    store.setItemAsync = async (key: string, value: string) => {
      store.values.set(key, value);
    };
    expect(await storage.getItem('hcp-auth-session')).toBe(long);
  });

  it('drops a revoked refresh token and keeps any other restore failure', () => {
    expect(refreshTokenWasRevoked({ message: 'Invalid Refresh Token: Already Used' })).toBe(true);
    expect(refreshTokenWasRevoked({ message: 'Refresh Token Not Found' })).toBe(true);
    expect(refreshTokenWasRevoked({ code: 'refresh_token_not_found' })).toBe(true);
    expect(refreshTokenWasRevoked({ message: 'Failed to fetch' })).toBe(false);
    expect(refreshTokenWasRevoked({ message: 'Network request failed' })).toBe(false);
    expect(refreshTokenWasRevoked(null)).toBe(false);
  });
});
