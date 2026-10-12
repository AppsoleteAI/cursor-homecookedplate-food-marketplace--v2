import * as Sentry from "@sentry/react-native";
import { scrubSentryEvent, sentryIdentity } from "@/lib/sentry-user";

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
    Sentry.setUser(sentryIdentity(user));
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

export { scrubSentryEvent, Sentry };
