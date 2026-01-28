import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { createServerSupabaseClient, createSupabaseAdmin } from "../lib/supabase";

type EnvBindings = {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
  EXPO_PUBLIC_WEB_URL?: string;
};

/**
 * Creates the tRPC context for each request.
 * 
 * CRITICAL RLS COMPLIANCE:
 * - ctx.supabase: Uses EXPO_PUBLIC_SUPABASE_ANON_KEY (anon key)
 *   - Respects Row Level Security (RLS) policies
 *   - Use for ALL user-facing operations (queries, inserts, updates)
 *   - User's JWT token is passed in Authorization header for RLS evaluation
 * 
 * - ctx.supabaseAdmin: Uses SUPABASE_SERVICE_ROLE_KEY (service role key)
 *   - BYPASSES Row Level Security (RLS) policies
 *   - Use ONLY for:
 *     * Admin operations (promote_to_admin, extend trial, etc.)
 *     * System operations (signup via admin.createUser, webhooks, audit logs)
 *     * Metro count increments (thread-safe atomic operations)
 *   - NEVER use for regular user operations - this would bypass all security!
 * 
 * @param opts - tRPC fetch adapter options (contains request headers, URL, etc.)
 * @param env - Environment bindings (Cloudflare Workers) or undefined (Bun/Node)
 * @returns Context object with supabase (anon), supabaseAdmin (service role), and userId
 */
export const createContext = async (opts: FetchCreateContextFnOptions, env?: EnvBindings) => {
  // #region agent log - HYPOTHESIS G, H: Track tRPC context creation
  const path = opts.req.url;
  const method = opts.req.method;
  fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/trpc/create-context.ts:CONTEXT_CREATE',message:'tRPC context created',data:{path,method,hasAuthHeader:!!opts.req.headers.get('authorization')},timestamp:Date.now(),sessionId:'debug-session',runId:'trpc-request',hypothesisId:'G,H'})}).catch(()=>{});
  // #endregion
  
  const authHeader = opts.req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  // CRITICAL: Create supabase client using ANON KEY - respects RLS policies
  // Uses EXPO_PUBLIC_SUPABASE_ANON_KEY, not service role key
  // User's JWT token is passed in Authorization header for RLS evaluation
  // Use ctx.supabase for ALL user-facing operations (queries, inserts, updates)
  const supabase = createServerSupabaseClient(token, env);

  // CRITICAL: Create supabaseAdmin using SERVICE ROLE KEY - bypasses RLS policies
  // Use ONLY for admin/system operations:
  // - Signup via admin.createUser()
  // - Webhooks and system operations
  // - Audit log inserts
  // - Metro count increments (thread-safe atomic operations)
  // NEVER use for regular user operations - this would bypass all security!
  let supabaseAdmin;
  if (env?.SUPABASE_URL && env?.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseAdmin = createSupabaseAdmin(env);
  } else {
    // Fallback for Bun/Node - try to import the module-level client
    const { supabaseAdmin: moduleAdmin } = await import("../lib/supabase");
    if (!moduleAdmin) {
      throw new Error('Supabase admin client not available. Environment variables must be provided in Cloudflare Workers.');
    }
    supabaseAdmin = moduleAdmin;
  }

  // Verify JWT token using anon key client (respects RLS)
  let userId: string | null = null;
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    userId = data.user?.id ?? null;
  }

  return {
    req: opts.req,
    supabase, // ANON KEY - Use for all user operations (respects RLS)
    supabaseAdmin, // SERVICE ROLE KEY - Use ONLY for admin/system operations (bypasses RLS)
    userId,
    webUrl: env?.EXPO_PUBLIC_WEB_URL || 'https://homecookedplate.com', // Web URL for redirects (password reset, etc.)
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    let message = shape.message;

    // 1. Handle Zod Validation Errors (like the password rules)
    if (error.code === 'BAD_REQUEST' && error.cause instanceof z.ZodError) {
      const fieldErrors = error.cause.flatten().fieldErrors;
      message = fieldErrors.password?.[0] 
                || fieldErrors.email?.[0]
                || fieldErrors.username?.[0]
                || "Please check your input fields.";
    }
    // 2. Handle Unique DB Constraints (PostgreSQL error code 23505)
    // Check both error code (more reliable) and message (for field-specific messages)
    else if (error.cause?.code === '23505' || error.cause?.message?.includes('UNIQUE constraint failed')) {
      const errorMessage = error.cause.message || '';
      if (errorMessage.includes('email') || errorMessage.includes('users.email') || errorMessage.includes('profiles.email')) {
        message = "That email is already registered.";
      } else if (errorMessage.includes('username') || errorMessage.includes('users.username') || errorMessage.includes('profiles.username')) {
        message = "That username is already taken.";
      } else {
        message = "This record (email or username) already exists.";
      }
    } 
    // 3. Catch Generic Server Crashes
    else if (error.code === 'INTERNAL_SERVER_ERROR') {
      message = "Our kitchen is a bit busy right now. Please try again in a moment!";
    }

    return {
      ...shape,
      message, // This overwrites the raw error message sent to the frontend
    };
  },
});

/**
 * The "Bouncer" Middleware - Acts as a security guard for protected routes
 * 
 * This middleware verifies JWT tokens from Supabase Auth:
 * 1. Checks for Authorization header with "Bearer <token>" format
 * 2. Verifies the token was validated in context creation (ctx.userId is set)
 * 3. Passes user information to the next step of the request
 * 
 * JWT Verification Flow:
 * - Token is extracted from Authorization header in createContext()
 * - Supabase's getUser(token) verifies the JWT signature and expiration
 * - If valid, userId is set in context; if invalid, userId remains null
 * - This middleware double-checks that userId exists before allowing access
 */
const isAuthenticated = t.middleware(async ({ ctx, next }) => {
  const authHeader = ctx.req.headers.get('Authorization');

  // Check if Authorization header exists and has the correct format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new TRPCError({ 
      code: 'UNAUTHORIZED', 
      message: 'No ID card found! Please log in to access this resource.' 
    });
  }

  const token = authHeader.split(' ')[1];
  
  // Verify the JWT token using Supabase (already done in context, but we double-check)
  // The token was verified in createContext() via supabase.auth.getUser(token)
  // If userId is not set, it means the token verification failed
  if (!ctx.userId) {
    throw new TRPCError({ 
      code: 'UNAUTHORIZED', 
      message: 'ID card is fake or expired. Please log in again.' 
    });
  }

  // Token is valid - pass the user info into the next step of the request
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId, // User ID from verified JWT token
      user: { id: ctx.userId }, // Also provide as 'user' for consistency with example
    },
  });
});

/**
 * Admin Middleware - Uses checkIsAdmin helper for consistency
 * 
 * SECURITY: This middleware uses the checkIsAdmin helper from security.ts
 * which queries the profiles table to verify is_admin status.
 * The SQL function public.is_admin() has execute permissions revoked from
 * anon/authenticated roles, so we query directly (matching security.ts pattern).
 */
const isAdmin = t.middleware(async ({ ctx, next }) => {
  // First check authentication (reuse the same check as isAuthenticated)
  if (!ctx.userId) {
    throw new TRPCError({ 
      code: 'UNAUTHORIZED', 
      message: 'No ID card found! Please log in to access this resource.' 
    });
  }

  // Check if user has admin privileges using the same pattern as security.ts
  // Note: We query directly here instead of importing checkIsAdmin to avoid
  // circular dependencies and keep middleware lightweight
  const { data: profile, error } = await ctx.supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', ctx.userId)
    .single();

  if (error || !profile?.is_admin) {
    throw new TRPCError({ 
      code: 'FORBIDDEN', 
      message: 'Admin privileges required. You do not have permission to perform this action.' 
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      user: { id: ctx.userId },
    },
  });
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(isAdmin);
