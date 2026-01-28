import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const checkUsernameProcedure = publicProcedure
  .input(z.object({ username: z.string().min(1) }))
  .query(async ({ input, ctx }) => {
    try {
      // Check if username exists in profiles table
      const { data, error } = await ctx.supabase
        .from('profiles')
        .select('id')
        .eq('username', input.username.toLowerCase().trim())
        .maybeSingle();

      if (error) {
        console.error('[CheckUsername] Database error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to check username availability',
        });
      }

      return { available: !data };
    } catch (error) {
      console.error('[CheckUsername] Error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to check username availability',
      });
    }
  });
