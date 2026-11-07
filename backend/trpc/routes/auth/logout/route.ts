import { sessionProcedure } from "../../../create-context";

export const logoutProcedure = sessionProcedure
  .mutation(async ({ ctx }) => {
    const { error } = await ctx.supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    return { success: true };
  });
