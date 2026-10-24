import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { nearestMetro } from "../../../../lib/metro-radius";

export const checkEligibilityProcedure = publicProcedure
  .input(
    z.object({
      lat: z.number(),
      lng: z.number(),
    })
  )
  .query(async ({ input }) => {
    const metroName = nearestMetro(input.lat, input.lng)?.name ?? null;

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
