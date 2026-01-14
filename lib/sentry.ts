import * as Sentry from "@sentry/react-native";

export function captureException(error: Error, context?: Record<string, any>) {
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

export function captureMessage(message: string, level: Sentry.SeverityLevel = "info") {
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  }
}

export function setUser(user: { id: string; email?: string; username?: string } | null) {
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.username,
      });
    } else {
      Sentry.setUser(null);
    }
  }
}

export function addBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: "info",
    });
  }
}

export { Sentry };
