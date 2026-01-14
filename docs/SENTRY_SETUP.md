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
When users log in, their ID and role are attached to error reports for better debugging.

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
  email: user.email,
  username: user.username,
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
- User IDs and emails are attached for debugging context only
- You can customize what data is sent by modifying `lib/sentry.ts`

## Performance Monitoring

The current setup includes basic performance tracking:
- `tracesSampleRate: 1.0` means 100% of transactions are tracked
- For high-traffic apps, reduce this to 0.1 (10%) or lower

## Cost

- Sentry offers a generous free tier (5,000 errors/month)
- Perfect for small to medium apps
- Upgrade if you need more volume

## Support

For issues with Sentry integration:
1. Check [Sentry React Native docs](https://docs.sentry.io/platforms/react-native/)
2. Verify your DSN is correct
3. Ensure you're on the latest `@sentry/react-native` version
