export const ACCESS_TOKEN_WAIT_MS = 400;

let remembered: string | null = null;

export function rememberAccessToken(token: string | null) {
  remembered = token;
}

export function currentAccessToken(): string | null {
  return remembered;
}

/**
 * Sign-in reads the saved session before the request is sent. That read waits
 * on the Supabase auth lock, and the lock has no timeout. A refresh that never
 * returns holds the lock, the request never starts, and the sign-in screen
 * shows "Request timed out" after 10 seconds.
 *
 * Wait briefly. If the read does not finish, use the token already saved for
 * this app. A late empty read must not erase that saved token.
 */
export function readAccessToken(read: () => Promise<string | null>): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      resolve(token);
    };
    const timer = setTimeout(() => finish(remembered), ACCESS_TOKEN_WAIT_MS);
    read().then((token) => {
      clearTimeout(timer);
      if (!settled) {
        remembered = token;
        finish(token);
      }
    }).catch(() => {
      clearTimeout(timer);
      finish(remembered);
    });
  });
}
