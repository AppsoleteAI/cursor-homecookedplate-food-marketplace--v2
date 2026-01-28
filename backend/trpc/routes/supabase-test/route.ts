import { publicProcedure } from "../../create-context";

export const supabaseTestProcedure = publicProcedure.query(async ({ ctx }) => {
  try {
    // Test connection by checking if profiles table exists and is queryable
    const { data, error } = await ctx.supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    if (error) {
      // Check if it's a "relation does not exist" error (table not created)
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return {
          connected: true,
          message: 'Supabase is connected, but the profiles table does not exist. Please run the SQL migrations in Supabase SQL Editor.',
          error: error.message,
          tablesExist: false,
        };
      }
      
      return {
        connected: false,
        message: 'Supabase is configured but query failed.',
        error: error.message,
        tablesExist: false,
      };
    }
    
    return {
      connected: true,
      message: 'Supabase is connected and working! Profiles table exists and is queryable.',
      tablesExist: true,
      data: data ? `Found ${data.length} profile(s)` : 'No profiles found',
    };
  } catch (error) {
    return {
      connected: false,
      message: 'Supabase connection test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      tablesExist: false,
    };
  }
});
