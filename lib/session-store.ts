/**
 * One saved session for the website and the phone.
 * A second copy let an older refresh token get used again and revoke the account.
 * Values are split so a long session still fits in the phone keychain.
 * A failed write leaves the previous value in place.
 */

const CHUNK = 1800;
const MARK = 'hcp-chunks:';
const CHUNK_LIMIT = 16;

export const SESSION_STORAGE_KEY = 'hcp-auth-session';
export const LEGACY_SESSION_KEY = 'rork_secure_session';

type KeyValueStore = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

async function clearExtra(store: KeyValueStore, key: string) {
  for (let i = 0; i < CHUNK_LIMIT; i += 1) {
    await store.deleteItemAsync(`${key}.${i}`).catch(() => undefined);
    await store.deleteItemAsync(`${key}.next.${i}`).catch(() => undefined);
  }
}

export function chunkedSecureStorage(store: KeyValueStore) {
  return {
    async getItem(key: string): Promise<string | null> {
      const head = await store.getItemAsync(key);
      if (head == null || !head.startsWith(MARK)) return head;
      const count = Number(head.slice(MARK.length));
      if (!Number.isInteger(count) || count < 1 || count > CHUNK_LIMIT) return null;
      const parts: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const part = await store.getItemAsync(`${key}.${i}`);
        if (part == null) return null;
        parts.push(part);
      }
      return parts.join('');
    },
    async setItem(key: string, value: string): Promise<void> {
      if (value.length <= CHUNK) {
        await store.setItemAsync(key, value);
        await clearExtra(store, key);
        return;
      }
      const count = Math.ceil(value.length / CHUNK);
      if (count > CHUNK_LIMIT) throw new Error('Session is too large to store.');
      for (let i = 0; i < count; i += 1) {
        await store.setItemAsync(`${key}.next.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
      }
      for (let i = 0; i < count; i += 1) {
        const part = await store.getItemAsync(`${key}.next.${i}`);
        if (part == null) throw new Error('Session chunk was not stored.');
        await store.setItemAsync(`${key}.${i}`, part);
      }
      await store.setItemAsync(key, `${MARK}${count}`);
      for (let i = 0; i < count; i += 1) {
        await store.deleteItemAsync(`${key}.next.${i}`).catch(() => undefined);
      }
    },
    async removeItem(key: string): Promise<void> {
      await store.deleteItemAsync(key);
      await clearExtra(store, key);
    },
  };
}

/** A revoked or already-used refresh token cannot be kept. Any other failure stays stored. */
export function refreshTokenWasRevoked(error: { message?: string; code?: string } | null | undefined): boolean {
  const text = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase();
  if (!text.trim()) return false;
  if (/network|fetch|timeout|failed to fetch/.test(text)) return false;
  return /refresh[ _]?token|invalid_grant|revoked/.test(text);
}
