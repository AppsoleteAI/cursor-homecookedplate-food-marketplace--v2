import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { reactivateTurnsAccountOn } from "../../../../lib/account-security";
import { readProviderButtonMessage } from "../../../../lib/provider-profile";

export const reactivateAccountProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { data, error } = await ctx.supabase.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password,
    });
    if (error || !data.user) {
      const { data: existingAccount } = await ctx.supabaseAdmin
        .from('profiles')
        .select('id')
        .ilike('email', input.email.trim())
        .maybeSingle();
      const buttonMessage = await readProviderButtonMessage(ctx.supabaseAdmin, input.email.trim(), existingAccount?.id);
      throw new TRPCError({
        code: buttonMessage ? 'CONFLICT' : 'UNAUTHORIZED',
        message: buttonMessage || 'That email or password does not match.',
      });
    }

    const lookup = await ctx.supabaseAdmin
      .from('profiles')
      .select('id, is_paused')
      .eq('id', data.user.id)
      .maybeSingle();
    if (lookup.error || !lookup.data) {
      await ctx.supabase.auth.signOut();
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
    }
    if (!reactivateTurnsAccountOn(true, lookup.data.is_paused === true)) {
      await ctx.supabase.auth.signOut();
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This account is not paused. Sign in normally.',
      });
    }

    const { error: updateError } = await ctx.supabaseAdmin
      .from('profiles')
      .update({ is_paused: false })
      .eq('id', lookup.data.id);
    await ctx.supabase.auth.signOut();
    if (updateError) {
      console.error('[Reactivate Account] Error:', updateError);
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'The account could not be turned back on.' });
    }

    return {
      success: true,
      message: 'Your account is back on. Sign in with your email and password.',
    };
  });
