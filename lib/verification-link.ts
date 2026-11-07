const TOKEN = /([0-9a-fA-F]{32,128})/;

function decodePiece(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The confirmation token from a web link, an app link, or the token by itself. */
export function tokenFromLink(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = decodePiece(value).trim();
  const query = text.match(new RegExp(`[?&#]token=${TOKEN.source}`));
  if (query?.[1]) return query[1].toLowerCase();
  const path = text.match(new RegExp(`verify-email/${TOKEN.source}(?![0-9a-fA-F])`));
  if (path?.[1]) return path[1].toLowerCase();
  const bare = text.match(new RegExp(`^${TOKEN.source}$`));
  return bare?.[1] ? bare[1].toLowerCase() : null;
}

/** A used confirmation link is a confirmed address, for either role. */
export function confirmationAlreadyDone(message: string | null | undefined): boolean {
  return /already been used|already verified|already confirmed/i.test(message || '');
}

export type RecoveryLink = {
  accessToken: string | null;
  refreshToken: string | null;
  type: string | null;
  code: string | null;
  tokenHash: string | null;
  errorDescription: string | null;
};

const RECOVERY_KEYS = [
  'access_token',
  'refresh_token',
  'expires_in',
  'expires_at',
  'token_type',
  'type',
  'code',
  'token_hash',
  'error_description',
] as const;

let recoveryScreenOpen = false;

/** The reset screen is open, so a failed link should stay here. */
export function markRecoveryScreen(open: boolean) {
  recoveryScreenOpen = open;
}

export function recoveryScreenIsOpen(): boolean {
  return recoveryScreenOpen;
}

function readParams(text: string): URLSearchParams {
  const query = text.match(/\?([^#]*)/)?.[1] ?? '';
  const hash = text.match(/#([^#]*)$/)?.[1] ?? '';
  const loose = !text.includes('?') && !text.includes('#') && text.includes('=') ? text.replace(/^\?/, '') : '';
  const params = new URLSearchParams(loose || query);
  new URLSearchParams(hash).forEach((value, key) => {
    if (!params.get(key)) params.set(key, value);
  });
  return params;
}

function pick(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  return value && value.length > 0 ? value : null;
}

/** A reset link is present when any recovery field arrived. An existing session must not be used instead. */
export function recoveryLinkPresent(recovery: RecoveryLink): boolean {
  return Boolean(
    recovery.errorDescription ||
    recovery.accessToken ||
    recovery.refreshToken ||
    recovery.code ||
    recovery.tokenHash ||
    recovery.type
  );
}

/** Tokens from a reset link. Supabase puts them in the hash, after the #. */
export function recoveryFromLink(...values: (string | null | undefined)[]): RecoveryLink {
  const merged = new URLSearchParams();
  for (const value of values) {
    if (!value) continue;
    readParams(value).forEach((item, key) => {
      if (!merged.get(key)) merged.set(key, item);
    });
  }
  return {
    accessToken: pick(merged, 'access_token'),
    refreshToken: pick(merged, 'refresh_token'),
    type: pick(merged, 'type'),
    code: pick(merged, 'code'),
    tokenHash: pick(merged, 'token_hash'),
    errorDescription: pick(merged, 'error_description'),
  };
}

/** Keep the reset tokens when a native link is rewritten for the router. */
export function resetPasswordRoute(path: string): string {
  const params = readParams(path);
  const kept = new URLSearchParams();
  for (const key of RECOVERY_KEYS) {
    const value = params.get(key);
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  return query ? `/reset-password?${query}` : '/reset-password';
}

/** Native app links land here before the router. Other links stay on the home path. */
export function confirmationPath(path: string): string | null {
  if (/verify-email/i.test(path)) {
    const token = tokenFromLink(path);
    return token ? `/verify-email?token=${token}` : '/verify-email';
  }
  if (/reset-password/i.test(path)) {
    return resetPasswordRoute(path);
  }
  return null;
}
