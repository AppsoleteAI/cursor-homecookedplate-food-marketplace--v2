import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";
import { orderBuyerId, orderCookId, readOrderQuery } from "../../../../lib/order-row";
import { orderPaymentConfirmed } from "../../../../lib/order-payment";
import { auditTextField } from "../../../../lib/text-audit";
import { missingColumn, notifyModerators } from "../../../../lib/content-moderation";
import { paidContactDecision } from "@/lib/order-contact";

export const sendMessageProcedure = protectedProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      text: z.string().max(1000).default(''),
      etaMinutes: z.number().int().min(5).max(240).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { orderId } = input;
    const userId = ctx.userId;
    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (!profile) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "User profile not found",
      });
    }

    const userRole = profile.role as "platemaker" | "platetaker";
    const order = await loadOrderParty(ctx.supabaseAdmin, orderId);

    if (!order) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Order not found",
      });
    }

    const buyerId = orderBuyerId(order);
    if (buyerId !== userId && orderCookId(order) !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not part of this order conversation",
      });
    }

    const paid = await orderPaymentConfirmed(order, ctx.supabaseAdmin, ctx.stripeSecretKey || process.env.STRIPE_SECRET_KEY);
    const decision = paidContactDecision({
      paid,
      role: userRole,
      etaMinutes: input.etaMinutes,
      text: input.text,
    });
    if (!decision.ok) {
      throw new TRPCError({
        code: decision.message.startsWith('Choose') || decision.message.startsWith('That message') ? 'BAD_REQUEST' : 'FORBIDDEN',
        message: decision.message,
      });
    }

    const scanned = await auditTextField(ctx.supabaseAdmin, userId, 'order_message', decision.text);
    if (scanned.blocked || !scanned.value.trim()) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That message cannot be sent.' });
    }
    const text = scanned.value;

    const insertMessage = (held: boolean) => ctx.supabase
      .from("order_messages")
      .insert({
        order_id: orderId,
        sender_id: userId,
        sender_role: userRole,
        text,
        ...(held ? { moderation_status: 'pending' } : {}),
      })
      .select()
      .single();
    let { data: message, error } = await insertMessage(true);
    if (error && missingColumn(error.message, 'moderation_status')) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'A moderator queue is not on this kitchen yet. The message was not sent.',
      });
    }

    if (error || !message) {
      console.error("Failed to send message:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send message",
      });
    }

    await notifyModerators(ctx.supabaseAdmin, userId, {
      title: 'Message waiting',
      body: 'An order message is waiting for a moderator.',
    });

    return {
      id: message.id,
      orderId: message.order_id,
      senderId: message.sender_id,
      senderRole: message.sender_role,
      text: message.text,
      moderationStatus: message.moderation_status || 'pending',
      createdAt: message.created_at,
    };
  });

async function loadOrderParty(admin: { from: (table: string) => any }, orderId: string) {
  const result = await readOrderQuery((columns) => admin.from('orders').select(columns).eq('id', orderId).maybeSingle());
  if (result.error) return null;
  return result.data;
}
