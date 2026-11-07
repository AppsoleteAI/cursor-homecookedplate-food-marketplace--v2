import { sendNoticeEmail, sendSignInCode } from '../email';
import { notifyParty, readNoticePrefs } from '../account-notice';
import { sendExpoPushNotification } from '../expo-push-notifications';
import {
  FREE_EMAILS_PER_MONTH,
  FREE_EMAILS_PER_UTC_DAY,
  fitsFreeEmailDay,
  fitsFreeEmailMonth,
  orderNoticeEmails,
  plateTakerOrders,
} from '../free-mail';
import { MAIL_PER_PAID_ORDER, orderMailFits } from '../request-budget';

const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: (...args: unknown[]) => mockSend(...args),
    },
  })),
}));

jest.mock('../expo-push-notifications', () => ({
  sendExpoPushNotification: jest.fn(),
}));

const push = sendExpoPushNotification as jest.Mock;

function chain(result: unknown) {
  const api = {
    select: () => api,
    eq: () => api,
    order: () => api,
    limit: () => Promise.resolve(result),
    insert: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
  };
  return api;
}

function adminFor(prefs: unknown, profile: { email?: string; expo_push_token?: string } | null) {
  return {
    from(table: string) {
      if (table === 'audit_logs') return chain({ data: prefs });
      if (table === 'notifications') return chain({ error: null });
      return chain({ data: profile });
    },
  };
}

describe('free mail', () => {
  const previousKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    mockSend.mockReset();
    push.mockReset();
    process.env.RESEND_API_KEY = 're_test_key';
  });

  afterAll(() => {
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  });

  it('does not fit 250 orders on the free day, and one day of those orders fits the month', () => {
    const orders = plateTakerOrders(5_000, 0.05);
    const sends = orderNoticeEmails(orders);
    expect(orders).toBe(250);
    expect(sends).toBe(750);
    expect(orders * MAIL_PER_PAID_ORDER).toBe(1_000);
    expect(orderMailFits(orders)).toBe(false);
    expect(fitsFreeEmailDay(sends)).toBe(false);
    expect(fitsFreeEmailMonth(sends)).toBe(true);
    expect(fitsFreeEmailDay(FREE_EMAILS_PER_UTC_DAY)).toBe(true);
    expect(fitsFreeEmailDay(FREE_EMAILS_PER_UTC_DAY + 1)).toBe(false);
    expect(fitsFreeEmailMonth(FREE_EMAILS_PER_MONTH)).toBe(true);
    expect(fitsFreeEmailMonth(FREE_EMAILS_PER_MONTH + 1)).toBe(false);
  });

  it('treats a Resend quota error as an unsent sign-in code and an unsent notice', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'You have reached your daily email sending quota.' },
    });
    await expect(sendSignInCode('buyer@example.com', '123456')).rejects.toThrow(/could not be emailed/);
    await expect(sendNoticeEmail('buyer@example.com', 'Payment received', 'A buyer paid.')).resolves.toBe(false);
  });

  it('sends push after the email cap rejects the notice', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'daily quota' } });
    push.mockResolvedValue(true);
    const admin = adminFor([], { email: 'cook@example.com', expo_push_token: 'ExponentPushToken[abc]' });
    await notifyParty(admin, 'cook-1', 'paymentAlerts', { title: 'Payment received', body: 'Paid.' });
    expect(mockSend).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('ExponentPushToken[abc]', expect.objectContaining({ title: 'Payment received' }));
  });

  it('sends push when email notices are off, and skips both when that notice is off', async () => {
    mockSend.mockResolvedValue({ data: { id: 'ok' }, error: null });
    push.mockResolvedValue(true);
    const emailOff = adminFor(
      [{ new_data: { emailNotifications: false, pushNotifications: true, paymentAlerts: true } }],
      { email: 'cook@example.com', expo_push_token: 'ExponentPushToken[abc]' },
    );
    await notifyParty(emailOff, 'cook-1', 'paymentAlerts', { title: 'Payment received', body: 'Paid.' });
    expect(mockSend).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledTimes(1);

    push.mockClear();
    const kindOff = adminFor(
      [{ new_data: { paymentAlerts: false, emailNotifications: true, pushNotifications: true } }],
      { email: 'cook@example.com', expo_push_token: 'ExponentPushToken[abc]' },
    );
    await notifyParty(kindOff, 'cook-1', 'paymentAlerts', { title: 'Payment received', body: 'Paid.' });
    expect(push).not.toHaveBeenCalled();
  });

  it('defaults email notices to on', async () => {
    const prefs = await readNoticePrefs(adminFor([], null), 'buyer-1');
    expect(prefs.emailNotifications).toBe(true);
    expect(prefs.pushNotifications).toBe(true);
    expect(prefs.orderUpdates).toBe(true);
    expect(prefs.paymentAlerts).toBe(true);
  });
});
