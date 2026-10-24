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

/** Native app links land here before the router. Other links stay on the home path. */
export function confirmationPath(path: string): string | null {
  if (/verify-email/i.test(path)) {
    const token = tokenFromLink(path);
    return token ? `/verify-email?token=${token}` : '/verify-email';
  }
  if (/reset-password/i.test(path)) {
    const query = path.match(/\?[^#]*/)?.[0] ?? '';
    return `/reset-password${query}`;
  }
  return null;
}
