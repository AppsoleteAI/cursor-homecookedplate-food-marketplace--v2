import { publicProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";

/**
 * Database Health Check Procedure
 * Verifies that Cloudflare Worker can connect to Supabase and query the profiles table
 */
export const dbHealthProcedure = publicProcedure.query(async ({ ctx }) => {
  try {
    // Perform a simple count query to test connection
    // Using count with head: true is efficient and doesn't return data
    const { count, error } = await ctx.supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      // Check if it's a "relation does not exist" error (table not created)
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database connection works, but profiles table does not exist. Please run SQL migrations in Supabase SQL Editor.',
          cause: error,
        });
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `DB Connection Failed: ${error.message}`,
        cause: error,
      });
    }

    return {
      status: 'online',
      database: 'Supabase/PostgreSQL',
      timestamp: new Date().toISOString(),
      profilesCount: count ?? 0,
      message: 'Database connection successful',
    };
  } catch (error: any) {
    // If it's already a TRPCError, re-throw it
    if (error instanceof TRPCError) {
      throw error;
    }
    
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `DB Connection Failed: ${error.message || 'Unknown error'}`,
      cause: error,
    });
  }
});
