import type { SupabaseClient } from "@supabase/supabase-js";
import { logAdminAlert } from "./alerts";

/** Stable Worker log line. A Cloudflare notification pages on this text. */
export const KV_DAILY_WRITE_CAP = "KV_DAILY_WRITE_CAP";

export function logKvWriteCap(): void {
  console.error(KV_DAILY_WRITE_CAP);
}

export async function alertKvWriteCap(admin?: SupabaseClient): Promise<void> {
  if (!admin) return;
  await logAdminAlert(
    "security_alert",
    "The daily KV write limit is full. Sign-in and signup are counted in memory on this Worker until the day resets.",
    {
      severity: "critical",
      title: "KV daily write limit",
      metadata: { signal: KV_DAILY_WRITE_CAP },
    },
    admin,
  );
}
