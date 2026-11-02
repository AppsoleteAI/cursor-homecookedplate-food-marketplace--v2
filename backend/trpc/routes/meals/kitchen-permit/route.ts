import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { evaluateKitchenPermit, KITCHEN_AGREEMENT_BLOCK, kitchenPermitFromUnknown, type KitchenPermitRecord } from '@/lib/kitchen-permit';
import { protectedProcedure } from '../../../create-context';

function missingPermitColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === 'PGRST204' || /kitchen_permit/.test(error.message || '');
}

export const kitchenPermitProcedure = protectedProcedure.query(async ({ ctx }) => {
  const row = await ctx.supabaseAdmin.from('profiles').select('kitchen_permit').eq('id', ctx.userId).maybeSingle();
  if (missingPermitColumn(row.error)) {
    return { saved: false, permit: null as KitchenPermitRecord | null, blocks: [KITCHEN_AGREEMENT_BLOCK] };
  }
  const permit = kitchenPermitFromUnknown(row.data?.kitchen_permit);
  const check = evaluateKitchenPermit(permit);
  return { saved: check.ok, permit, blocks: check.blocks };
});

const agreementInput = z.object({
  readFoodInformation: z.boolean(),
  readStateInformation: z.boolean(),
  acceptsLocalRules: z.boolean(),
  acceptsAllLiability: z.boolean(),
  waivesPlatformLiability: z.boolean(),
  maintainsCommissaryAccess: z.boolean(),
});

export const saveKitchenPermitProcedure = protectedProcedure
  .input(agreementInput)
  .mutation(async ({ ctx, input }) => {
    const profile = await ctx.supabaseAdmin.from('profiles').select('role').eq('id', ctx.userId).maybeSingle();
    if (profile.data?.role !== 'platemaker') {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'A home-kitchen agreement is saved on a PlateMaker account.' });
    }
    const record: KitchenPermitRecord = {
      ...input,
      updatedAt: new Date().toISOString(),
    };
    const check = evaluateKitchenPermit(record);
    if (!check.ok) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: check.blocks[0] });
    }
    const saved = await ctx.supabaseAdmin.from('profiles').update({
      kitchen_permit: record,
      updated_at: record.updatedAt,
    }).eq('id', ctx.userId);
    if (missingPermitColumn(saved.error)) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'The home-kitchen agreement could not be saved yet.' });
    }
    if (saved.error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The home-kitchen agreement was not saved.' });
    }
    return { saved: true, permit: record };
  });
