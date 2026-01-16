import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { createServerSupabaseClient } from "../lib/supabase";

export const createContext = async (opts: FetchCreateContextFnOptions) => {
  // #region agent log - HYPOTHESIS G, H: Track tRPC context creation
  const path = opts.req.url;
  const method = opts.req.method;
  fetch('http://127.0.0.1:7242/ingest/c5a3c12c-6414-4e0d-9ac0-7bf2d7cf2278',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'backend/trpc/create-context.ts:CONTEXT_CREATE',message:'tRPC context created',data:{path,method,hasAuthHeader:!!opts.req.headers.get('authorization')},timestamp:Date.now(),sessionId:'debug-session',runId:'trpc-request',hypothesisId:'G,H'})}).catch(()=>{});
  // #endregion
  
  const authHeader = opts.req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  const supabase = createServerSupabaseClient(token);

  let userId: string | null = null;
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    userId = data.user?.id ?? null;
  }

  return {
    req: opts.req,
    supabase,
    userId,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

const isAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  // Check if user has admin privileges
  const { data: profile, error } = await ctx.supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', ctx.userId)
    .single();

  if (error || !profile?.is_admin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(isAdmin);
