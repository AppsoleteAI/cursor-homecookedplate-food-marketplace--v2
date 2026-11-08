# Sentry Error Monitoring Setup

## Overview
Sentry is integrated into the app to automatically capture and track errors in production. This helps identify and fix bugs quickly.

## Configuration

### 1. Get Your Sentry DSN

1. Create a free account at [sentry.io](https://sentry.io)
2. Create a new React Native project
3. Copy your DSN from Settings → Projects → Your Project → Client Keys (DSN)

### 2. Add DSN to Environment Variables

Add the following to your `.env` file:

```env
EXPO_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

**Important:** The DSN is safe to expose in client-side code (it uses `EXPO_PUBLIC_` prefix).

### 3. Features Enabled

#### Automatic Error Tracking
- Unhandled JavaScript errors
- Promise rejections
- React component errors (via ErrorBoundary)

#### Manual Error Tracking
The app tracks errors in these critical areas:
- Authentication (login, signup, logout)
- Profile updates
- Order management
- Payment processing
- Data persistence (AsyncStorage)

#### User Context
When users log in, Sentry receives the user id only. Email, username, and IP address are not attached.

#### Breadcrumbs
User actions are logged as breadcrumbs:
- User logged in/out
- Profile updated
- Orders created/updated
- Messages sent

### 4. Error Boundary

A global `ErrorBoundary` component wraps the app to catch React rendering errors and display a user-friendly error screen.

## Usage

### Capturing Exceptions

```typescript
import { captureException } from '@/lib/sentry';

try {
  // Your code
} catch (error) {
  captureException(error as Error, {
    context: 'operation-name',
    userId: user?.id,
    // Additional context
  });
  throw error;
}
```

### Capturing Messages

```typescript
import { captureMessage } from '@/lib/sentry';

captureMessage('Something unusual happened', 'warning');
```

### Setting User Context

```typescript
import { setUser } from '@/lib/sentry';

// After login
setUser({
  id: user.id,
});

// After logout
setUser(null);
```

### Adding Breadcrumbs

```typescript
import { addBreadcrumb } from '@/lib/sentry';

addBreadcrumb('Order created', 'order', {
  orderId: order.id,
  amount: order.total,
});
```

## Development vs Production

- **Development**: Sentry only logs errors to console (debug mode enabled)
- **Production**: Sentry sends all errors to your dashboard

If you don't set `EXPO_PUBLIC_SENTRY_DSN`, the app will work normally without Sentry.

## Testing

To test Sentry integration:

1. Set your DSN in `.env`
2. Trigger an error in the app
3. Check your Sentry dashboard

## Privacy

- No sensitive data (passwords, tokens) is sent to Sentry
- The user id is attached for debugging. Email and username are not sent
- You can customize what data is sent by modifying `lib/sentry.ts`

## Performance Monitoring

The current setup includes basic performance tracking:
- `tracesSampleRate` is `0.1`, so 10% of performance traces are tracked
- Error events are still reported. The rate applies to traces, not crashes
- `captureException` does not consult that rate. A PlateMaker and a PlateTaker each send the account id. Email, username, and IP are removed before the event is sent

## Worker write cap

When the KV daily write limit fills, the Worker logs `KV_DAILY_WRITE_CAP` once on that isolate and writes an admin alert when the service client is on the request. Signed in, that alert is for the shared API, so it covers a PlateMaker and a PlateTaker. Signed out, the same line covers the sign-in limit. Web, iOS, and Android use this Worker. `plate-marketplace-api` was deployed 5 November 2026, version `e48ba812-f010-4bfc-8e55-61e41b99d101`. The monitor **KV daily write cap** emails `support@homecookedplate.com` when that line appears. It was saved 5 November 2026 and checks every 1 minute.

The phone check in `docs/PHONE_DIAGNOSTICS.md` is still open. A local check scrubs an orders-refresh failure for each role down to the account id. That check does not open Sentry on a phone.

## Public read timing

`listMeals`, `getMeal`, and `listReviews` log `PUBLIC_READ` with the milliseconds and the request id. The log has no account id and no address. One in ten timings uses the Worker crash client and the same `0.1` trace rate. A signed-in PlateMaker or PlateTaker is the account id on that event. A signed-out read has no identity. No DSN leaves the timing in the Worker log. Dashboards and paging are not part of this client. This client is on the 7 November 2026 deploy, version `202d29a1-8559-4d01-8da3-58526873e797`. Web, iOS, and Android call this Worker through the site. Signed in, a cook and a buyer share it. Signed out, sign-in and a public review read share it.

## Worker crashes

A Worker crash posts to Sentry when `SENTRY_DSN` or `EXPO_PUBLIC_SENTRY_DSN` is set on `plate-marketplace-api`. The same scrub as the phone keeps the account id and drops email, username, and IP. An unhandled API crash and a failed payout run use that path. With no DSN the crash stays in the Worker log.

Payment, webhook, and security failures also write `admin_system_alerts`. A PlateMaker card or Connect failure and a PlateTaker payment-intent failure use `payment_error`. Stripe, App Store, and metro webhook failures use `webhook_error`. A rejected Stripe signature, a stale Stripe timestamp, and a rejected metro secret use `security_alert`. The saved text is scrubbed. Signed out, the same alerts cover the shared API. Signed in, a PlateMaker and a PlateTaker share that API. Web, iOS, and Android use this source.

`plate-marketplace-api` was published 5 November 2026 with this crash reporter. The code version then was `f8a7e194-15a3-4789-9a82-083276a62f1b`. The 5 November live version was `57626efa-5136-42bc-950a-6d212c5eec72`, which is that code plus the secret `SENTRY_DSN`. The live version on 7 November 2026 is `202d29a1-8559-4d01-8da3-58526873e797`. Existing secrets stayed in place. Five checks of `/` and `/health` each returned 200. Those checks did not throw a crash. The phone check in `docs/PHONE_DIAGNOSTICS.md` is still open.

## Cost

- Sentry offers a generous free tier (5,000 errors/month)
- Perfect for small to medium apps
- Upgrade if you need more volume

## Support

For issues with Sentry integration:
1. Check [Sentry React Native docs](https://docs.sentry.io/platforms/react-native/)
2. Verify your DSN is correct
3. Ensure you're on the latest `@sentry/react-native` version
