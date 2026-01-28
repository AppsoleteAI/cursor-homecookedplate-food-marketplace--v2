import { adminProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";

export const getCleanupStatsProcedure = adminProcedure.query(async ({ ctx }) => {
  // Get count of pending media cleanups from Section 6 of security_enhancements.sql
  // This interfaces directly with the security enhancements we wrote in SQL
  const { count, error } = await ctx.supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('action', 'DELETE_MEDIA_PENDING');

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to fetch cleanup stats: ${error.message}`,
    });
  }

  return { pendingCleanups: count || 0 };
});
