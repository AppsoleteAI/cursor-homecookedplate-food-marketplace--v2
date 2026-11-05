/** Tokens or a code returned by Apple or Google through the sign-in page. */
export function providerSessionFromRedirect(url: string): { code: string } | { accessToken: string; refreshToken: string } | null {
  const hashStart = url.indexOf('#');
  const queryStart = url.indexOf('?');
  const hash = hashStart >= 0 ? url.slice(hashStart + 1) : '';
  const query = queryStart >= 0
    ? url.slice(queryStart + 1, hashStart >= 0 ? hashStart : undefined)
    : '';
  const params = new URLSearchParams(hash || query);
  const code = params.get('code');
  if (code) return { code };
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) return { accessToken, refreshToken };
  return null;
}
