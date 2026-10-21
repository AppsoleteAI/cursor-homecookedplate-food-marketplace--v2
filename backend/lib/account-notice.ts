import { sendNoticeEmail } from './email';
import { sendExpoPushNotification } from './expo-push-notifications';

type Admin = { from: (table: string) => any };

export type NoticeKind = 'orderUpdates' | 'newMessages' | 'paymentAlerts' | 'reviewsRatings';

type NoticePrefs = {
  orderUpdates: boolean;
  newMessages: boolean;
  paymentAlerts: boolean;
  reviewsRatings: boolean;
  promotions: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
};

const DEFAULT_PREFS: NoticePrefs = {
  orderUpdates: true,
  newMessages: true,
  paymentAlerts: true,
  reviewsRatings: true,
  promotions: false,
  emailNotifications: true,
  pushNotifications: true,
};

export async function saveNoticePrefs(admin: Admin, userId: string, prefs: NoticePrefs): Promise<void> {
  const { error } = await admin.from('audit_logs').insert({
    user_id: userId,
    action: 'NOTIFICATION_PREFS',
    table_name: 'profiles',
    new_data: prefs,
  });
  if (error) throw new Error('Notification settings could not be saved.');
}

export async function readNoticePrefs(admin: Admin, userId: string): Promise<NoticePrefs> {
  const { data } = await admin
    .from('audit_logs')
    .select('new_data')
    .eq('user_id', userId)
    .eq('action', 'NOTIFICATION_PREFS')
    .order('created_at', { ascending: false })
    .limit(1);
  const stored = data?.[0]?.new_data;
  if (!stored || typeof stored !== 'object') return DEFAULT_PREFS;
  const row = stored as Partial<NoticePrefs>;
  return {
    orderUpdates: row.orderUpdates !== false,
    newMessages: row.newMessages !== false,
    paymentAlerts: row.paymentAlerts !== false,
    reviewsRatings: row.reviewsRatings !== false,
    promotions: row.promotions === true,
    emailNotifications: row.emailNotifications !== false,
    pushNotifications: row.pushNotifications !== false,
  };
}

const SELLER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The cook hears that a plate or a shop order was paid. A notice failure does not undo the payment. */
export async function notifyCookOfPayment(
  admin: Admin,
  sellerId: string | null | undefined,
  buyerPays: number,
): Promise<void> {
  if (!sellerId || !SELLER_ID.test(sellerId) || !(buyerPays > 0)) return;
  try {
    await notifyParty(admin, sellerId, 'paymentAlerts', {
      title: 'Payment received',
      body: `A buyer paid $${buyerPays.toFixed(2)}. Accept the order when you can cook it.`,
    });
  } catch (error) {
    console.error('[PaymentNotice] Notice was not sent:', error);
  }
}

/** Tells the other person by email and by push. A missing mail key does not undo the order. */
export async function notifyParty(
  admin: Admin,
  userId: string,
  kind: NoticeKind,
  notice: { title: string; body: string },
  options?: { evenWhenOrderUpdatesOff?: boolean; evenWhenKindOff?: boolean },
): Promise<void> {
  if (!userId) return;
  const prefs = await readNoticePrefs(admin, userId);
  const kindOff = options?.evenWhenOrderUpdatesOff || options?.evenWhenKindOff;
  if (!kindOff && !prefs[kind]) return;

  await admin.from('notifications').insert({
    user_id: userId,
    title: notice.title,
    body: notice.body,
    type: kind,
    read: false,
  });

  const { data: profile } = await admin
    .from('profiles')
    .select('email, expo_push_token')
    .eq('id', userId)
    .maybeSingle();

  if (prefs.emailNotifications && profile?.email) {
    try {
      await sendNoticeEmail(profile.email, notice.title, notice.body);
    } catch (error) {
      console.error('[Notice] Email failed:', error);
    }
  }
  if (prefs.pushNotifications && profile?.expo_push_token) {
    await sendExpoPushNotification(profile.expo_push_token, {
      title: notice.title,
      body: notice.body,
      data: { type: kind },
    });
  }
}
