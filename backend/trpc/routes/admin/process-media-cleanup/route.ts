import { adminProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { processMediaCleanup } from "../../../../lib/media-cleanup";

/**
 * Process Media Cleanup Procedure
 * 
 * Admin-only endpoint to process pending media cleanup requests.
 * This should be called periodically (e.g., via cron job or scheduled task)
 * to clean up orphaned media files from deleted meals.
 * 
 * Corresponds to SQL Section 6 in security_enhancements.sql
 * Uses the processMediaCleanup utility from backend/lib/media-cleanup.ts
 */
export const processMediaCleanupProcedure = adminProcedure
  .input(
    z.object({
      batchSize: z.number().min(1).max(100).optional().default(10),
    })
  )
  .mutation(async ({ input, ctx }) => {
    // Use supabaseAdmin (service role) to bypass RLS for cleanup operations
    // This ensures we can access all audit logs and delete storage files
    const result = await processMediaCleanup(ctx.supabaseAdmin, input.batchSize);

    if (result.failed > 0 && result.processed === 0) {
      // If all operations failed, throw an error
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Media cleanup failed: ${result.errors.map(e => e.error).join('; ')}`,
      });
    }

    return {
      success: true,
      processed: result.processed,
      failed: result.failed,
      skipped: result.skipped,
      errors: result.errors,
      message: result.failed > 0
        ? `Processed ${result.processed} cleanups with ${result.failed} failures`
        : `Successfully processed ${result.processed} cleanups`,
    };
  });
