import { publicProcedure } from "../../create-context";
import { createSupabaseAdmin } from "../../../lib/supabase";

/**
 * Comprehensive health check endpoint
 * Tests Supabase connection and verifies key tables exist
 */
export const healthCheckProcedure = publicProcedure.query(async ({ ctx }) => {
  const healthStatus = {
    timestamp: new Date().toISOString(),
    api: {
      status: 'ok',
      message: 'API is running',
    },
    supabase: {
      connected: false,
      url: null as string | null,
      tables: {} as Record<string, boolean>,
      error: null as string | null,
    },
    environment: {
      platform: typeof process === 'undefined' ? 'cloudflare-worker' : 'node',
      hasEnvVars: false,
    },
  };

  try {
    // Check environment variables
    const supabaseUrl = ctx.req?.headers?.get('x-supabase-url') || 
                       (typeof process !== 'undefined' ? process.env.SUPABASE_URL : null);
    const hasServiceKey = typeof process !== 'undefined' ? !!process.env.SUPABASE_SERVICE_ROLE_KEY : false;
    
    healthStatus.environment.hasEnvVars = !!(supabaseUrl || hasServiceKey);
    healthStatus.supabase.url = supabaseUrl || 'Not configured';

    // Try to create Supabase admin client (works in both environments)
    let supabaseAdmin;
    try {
      // In Cloudflare Workers, we need env from bindings
      // For health check, we'll try to use the context's supabaseAdmin if available
      if (ctx.supabaseAdmin) {
        supabaseAdmin = ctx.supabaseAdmin;
      } else {
        // Fallback: try to create with available env
        const env = {
          SUPABASE_URL: supabaseUrl || undefined,
          SUPABASE_SERVICE_ROLE_KEY: typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined,
        };
        if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
          supabaseAdmin = createSupabaseAdmin(env);
        } else {
          throw new Error('Supabase credentials not available');
        }
      }
    } catch (error) {
      healthStatus.supabase.error = error instanceof Error ? error.message : 'Failed to create Supabase client';
      return healthStatus;
    }

    // Test connection by querying information_schema (works in PostgreSQL)
    const { data: tables, error: schemaError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['profiles', 'meals', 'orders', 'reviews', 'notifications']);

    if (schemaError) {
      healthStatus.supabase.error = schemaError.message;
      return healthStatus;
    }

    // Check which tables exist
    const existingTables = tables?.map(t => t.table_name) || [];
    healthStatus.supabase.tables = {
      profiles: existingTables.includes('profiles'),
      meals: existingTables.includes('meals'),
      orders: existingTables.includes('orders'),
      reviews: existingTables.includes('reviews'),
      notifications: existingTables.includes('notifications'),
    };

    // Test actual query on profiles table (most critical)
    if (healthStatus.supabase.tables.profiles) {
      const { error: queryError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .limit(1);

      if (queryError) {
        healthStatus.supabase.error = `Query failed: ${queryError.message}`;
        return healthStatus;
      }
    }

    healthStatus.supabase.connected = true;
    healthStatus.supabase.error = null;

  } catch (error) {
    healthStatus.supabase.error = error instanceof Error ? error.message : 'Unknown error';
    healthStatus.supabase.connected = false;
  }

  return healthStatus;
});
