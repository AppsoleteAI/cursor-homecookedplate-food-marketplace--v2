import { ACCESS_TOKEN_WAIT_MS, currentAccessToken, readAccessToken, rememberAccessToken } from '@/lib/access-token';

describe('access token for a request', () => {
  beforeEach(() => {
    rememberAccessToken(null);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses a session that returns immediately', async () => {
    await expect(readAccessToken(async () => 'fresh')).resolves.toBe('fresh');
    expect(currentAccessToken()).toBe('fresh');
  });

  it('sends the saved token when the session read never returns', async () => {
    rememberAccessToken('saved');
    const pending = readAccessToken(() => new Promise(() => undefined));
    const assertion = expect(pending).resolves.toBe('saved');
    jest.advanceTimersByTime(ACCESS_TOKEN_WAIT_MS);
    await assertion;
    expect(currentAccessToken()).toBe('saved');
  });

  it('keeps the saved token when a late read comes back empty', async () => {
    rememberAccessToken('saved');
    let resolveRead: (token: string | null) => void = () => undefined;
    const pending = readAccessToken(() => new Promise((resolve) => {
      resolveRead = resolve;
    }));
    const assertion = expect(pending).resolves.toBe('saved');
    jest.advanceTimersByTime(ACCESS_TOKEN_WAIT_MS);
    await assertion;
    resolveRead(null);
    await Promise.resolve();
    expect(currentAccessToken()).toBe('saved');
  });
});
