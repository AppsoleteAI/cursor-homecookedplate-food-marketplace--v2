import { logPublicReadTiming } from "./request-id";
import type { PublicReadName } from "./worker-sentry";

type TimedRead = {
  requestId?: unknown;
  notePublicRead?: (read: PublicReadName, ms: number) => void;
};

/** Times one public read. The log is every call. Sentry stays on the existing client. */
export async function timePublicRead<T>(read: PublicReadName, ctx: TimedRead, run: () => PromiseLike<T>): Promise<T> {
  const started = Date.now();
  try {
    return await run();
  } finally {
    const ms = Date.now() - started;
    logPublicReadTiming(read, ctx.requestId, ms);
    try {
      ctx.notePublicRead?.(read, ms);
    } catch {
      console.error("[Sentry] Public read timing was not sent.");
    }
  }
}
