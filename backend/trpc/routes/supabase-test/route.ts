import { publicProcedure } from "../../create-context";

export const supabaseTestProcedure = publicProcedure.query(async ({ ctx }) => {
  try {
    const { data, error } = await ctx.supabase
      .from('test_table')
      .select('*')
      .limit(1);
    
    if (error) {
      return {
        connected: false,
        message: 'Supabase is configured but query failed. This is normal if you haven\'t created any tables yet.',
        error: error.message,
      };
    }
    
    return {
      connected: true,
      message: 'Supabase is connected and working!',
      data,
    };
  } catch (error) {
    return {
      connected: false,
      message: 'Supabase connection test failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});
