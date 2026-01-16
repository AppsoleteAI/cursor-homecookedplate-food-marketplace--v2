import { publicProcedure } from "../../../create-context";
import { z } from "zod";

export const checkEligibilityProcedure = publicProcedure
  .input(
    z.object({
      lat: z.number(),
      lng: z.number(),
    })
  )
  .query(async ({ input, ctx }) => {
    // Use PostGIS RPC to find metro area (simple check, no quota validation)
    const { data: metroName, error } = await ctx.supabase.rpc(
      'find_metro_by_location',
      { lng: input.lng, lat: input.lat }
    );

    if (metroName) {
      return {
        isEligibleForTrial: true,
        metroName,
        tier: 'Early Bird 90-Day Trial',
        price: '$0.00'
      };
    }

    return {
      isEligibleForTrial: false,
      metroName: 'Remote / Underserved Area',
      tier: 'Standard Remote Access',
      price: '$4.99/mo'
    };
  });
