import { sendEmailConfirmation } from '@/backend/lib/email';
import { appRouter } from '../../trpc/app-router';
import { ALREADY_CONFIRMED_SIGN_IN_MESSAGE, confirmationExpiresAt, CONFIRMATION_SEND_FAILED_MESSAGE, RESEND_CONFIRMATION_MESSAGE } from '../email-confirmation';

jest.mock('@/backend/lib/email', () => ({
  resendFailure: jest.fn(() => null),
  sendEmailConfirmation: jest.fn(async () => undefined),
  sendWelcomeEmail: jest.fn(async () => undefined),
  sendPasswordResetEmail: jest.fn(async () => undefined),
  sendSignInCode: jest.fn(async () => undefined),
  sendNoticeEmail: jest.fn(async () => true),
}));

type Row = Record<string, unknown>;

function harness(options: {
  role: 'platemaker' | 'platetaker';
  profile: boolean;
  confirmedAt?: string | null;
  oldToken?: string | null;
}) {
  const id = options.role === 'platemaker'
    ? '11111111-1111-4111-8111-111111111111'
    : '22222222-2222-4222-8222-222222222222';
  const email = options.role === 'platemaker' ? 'cook@example.com' : 'buyer@example.com';
  const tokens: Row[] = options.oldToken
    ? [{ user_id: id, token: options.oldToken, email, used_at: null, expires_at: '2026-11-06T18:00:00.000Z' }]
    : [];
  const profiles: Row[] = options.profile
    ? [{ id, username: options.role, email }]
    : [];
  const from = (table: string) => {
    const rows = table === 'profiles' ? profiles : tokens;
    const filters: ((row: Row) => boolean)[] = [];
    let mode: 'select' | 'update' | 'insert' = 'select';
    let patch: Row = {};
    let pending: Row | null = null;
    const run = () => {
      if (mode === 'insert' && pending) {
        const saved = pending;
        pending = null;
        tokens.push(saved);
        return { data: saved, error: null };
      }
      const matched = rows.filter((row) => filters.every((fn) => fn(row)));
      if (mode === 'update') {
        for (const row of matched) Object.assign(row, patch);
      }
      return { data: matched, error: null };
    };
    const chain = {
      select() { return chain; },
      ilike(key: string, value: string) {
        filters.push((row) => String(row[key]).toLowerCase() === value.toLowerCase());
        return chain;
      },
      eq(key: string, value: unknown) {
        filters.push((row) => row[key] === value);
        return chain;
      },
      is(key: string, value: unknown) {
        filters.push((row) => (value === null ? row[key] == null : row[key] === value));
        return chain;
      },
      neq(key: string, value: unknown) {
        filters.push((row) => row[key] !== value);
        return chain;
      },
      limit() { return run(); },
      update(next: Row) {
        mode = 'update';
        patch = next;
        return chain;
      },
      insert(next: Row) {
        mode = 'insert';
        pending = { ...next, used_at: null };
        return chain;
      },
      then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };
    return chain;
  };
  const caller = appRouter.createCaller({
    req: { headers: new Headers() },
    supabase: {},
    supabaseAdmin: {
      from,
      auth: {
        admin: {
          getUserById: async () => ({
            data: {
              user: options.profile
                ? { id, email_confirmed_at: options.confirmedAt ?? null }
                : null,
            },
            error: null,
          }),
        },
      },
    },
    userId: null,
    webUrl: 'https://homecookedplate.com',
  } as never);
  return { caller, tokens, email };
}

describe.each(['platemaker', 'platetaker'] as const)('confirmation resend for a %s', (role) => {
  beforeEach(() => {
    (sendEmailConfirmation as jest.Mock).mockReset();
    (sendEmailConfirmation as jest.Mock).mockResolvedValue(undefined);
  });

  it('uses one sentence and a fresh 24-hour link', async () => {
    expect(confirmationExpiresAt(Date.parse('2026-11-06T12:00:00.000Z'))).toBe('2026-11-07T12:00:00.000Z');

    const unknown = harness({ role, profile: false });
    await expect(unknown.caller.auth.resendVerificationEmail({ email: unknown.email })).resolves.toEqual({
      success: true,
      message: RESEND_CONFIRMATION_MESSAGE,
    });
    expect(sendEmailConfirmation).not.toHaveBeenCalled();

    const confirmed = harness({ role, profile: true, confirmedAt: '2026-11-01T00:00:00.000Z' });
    const confirmedResult = await confirmed.caller.auth.resendVerificationEmail({ email: confirmed.email });
    expect(confirmedResult).toEqual({ success: true, message: ALREADY_CONFIRMED_SIGN_IN_MESSAGE });
    expect(confirmedResult).not.toHaveProperty('alreadyConfirmed');
    expect(sendEmailConfirmation).not.toHaveBeenCalled();

    const open = harness({ role, profile: true, oldToken: 'dying-token' });
    const before = Date.now();
    const sent = await open.caller.auth.resendVerificationEmail({ email: open.email });
    expect(sent).toEqual({ success: true, message: RESEND_CONFIRMATION_MESSAGE });
    expect(sendEmailConfirmation).toHaveBeenCalledTimes(1);
    const mailedToken = (sendEmailConfirmation as jest.Mock).mock.calls[0][2] as string;
    expect(mailedToken).not.toBe('dying-token');
    const fresh = open.tokens.find((row) => row.token === mailedToken);
    const expires = Date.parse(String(fresh?.expires_at));
    expect(expires - before).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(expires - before).toBeLessThan(25 * 60 * 60 * 1000);
    expect(open.tokens.find((row) => row.token === 'dying-token')?.expires_at).toBe(new Date(0).toISOString());

    (sendEmailConfirmation as jest.Mock).mockRejectedValueOnce(new Error('not sent'));
    const failed = harness({ role, profile: true });
    await expect(failed.caller.auth.resendVerificationEmail({ email: failed.email })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
      message: CONFIRMATION_SEND_FAILED_MESSAGE,
    });
  });
});
