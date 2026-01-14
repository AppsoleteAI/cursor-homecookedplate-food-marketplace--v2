import { protectedProcedure } from "../../../create-context";

export const logoutProcedure = protectedProcedure
  .mutation(async ({ ctx }) => {
    const { error } = await ctx.supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  });
