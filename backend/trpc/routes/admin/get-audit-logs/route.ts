import { adminProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const getAuditLogsProcedure = adminProcedure
  .input(
    z.object({ 
      limit: z.number().default(20).min(1).max(100),
      offset: z.number().default(0).min(0),
    }).optional()
  )
  .query(async ({ ctx, input }) => {
    const limit = input?.limit ?? 20;
    const offset = input?.offset ?? 0;

    const { data, error } = await ctx.supabase
      .from('audit_logs')
      .select(`
        *,
        profiles:user_id (username, email)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to fetch audit logs: ${error.message}`,
      });
    }

    return data || [];
  });
