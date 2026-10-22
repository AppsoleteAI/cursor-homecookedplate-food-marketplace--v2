import { SESSION_RESTORE_MS, settleWithin } from '@/lib/settle-within';

describe('session restore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('a saved sign-in that never answers stops waiting', async () => {
    const pending = settleWithin(new Promise(() => undefined), SESSION_RESTORE_MS);
    const assertion = expect(pending).rejects.toThrow('timed out');
    jest.advanceTimersByTime(SESSION_RESTORE_MS);
    await assertion;
  });
});
