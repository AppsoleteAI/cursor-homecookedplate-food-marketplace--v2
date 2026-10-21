import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";
import { missingBuyerColumn, orderBuyerId } from "../../../../lib/order-row";
import { notifyParty } from "../../../../lib/account-notice";
import { sanitizeTextField } from "../../../../lib/text-security";

export const sendMessageProcedure = protectedProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      text: z.string().min(1).max(1000),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { orderId } = input;
    const scanned = sanitizeTextField(input.text);
    if (scanned.blocked || !scanned.value.trim()) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'That message cannot be sent.' });
    }
    const text = scanned.value;
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
    if (buyerId !== userId && order.seller_id !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not part of this order conversation",
      });
    }

    const { data: message, error } = await ctx.supabase
      .from("order_messages")
      .insert({
        order_id: orderId,
        sender_id: userId,
        sender_role: userRole,
        text,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to send message:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send message",
      });
    }

    const otherId = buyerId === userId ? order.seller_id : buyerId;
    await notifyParty(ctx.supabaseAdmin, otherId, 'newMessages', {
      title: 'New message',
      body: text.slice(0, 140),
    });

    return {
      id: message.id,
      orderId: message.order_id,
      senderId: message.sender_id,
      senderRole: message.sender_role,
      text: message.text,
      createdAt: message.created_at,
    };
  });

async function loadOrderParty(admin: { from: (table: string) => any }, orderId: string) {
  let result = await admin.from('orders').select('id, buyer_id, seller_id').eq('id', orderId).maybeSingle();
  if (result.error && missingBuyerColumn(result.error.message)) {
    result = await admin.from('orders').select('id, platetaker_id, seller_id').eq('id', orderId).maybeSingle();
  }
  if (result.error) return null;
  return result.data;
}
