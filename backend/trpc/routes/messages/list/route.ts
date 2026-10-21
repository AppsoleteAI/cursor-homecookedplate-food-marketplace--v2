import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";
import { missingBuyerColumn, orderBuyerId } from "../../../../lib/order-row";

export const listMessagesProcedure = protectedProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
    })
  )
  .query(async ({ ctx, input }) => {
    const { orderId } = input;
    const userId = ctx.userId;

    let orderResult = await ctx.supabaseAdmin
      .from("orders")
      .select("id, buyer_id, seller_id")
      .eq("id", orderId)
      .maybeSingle();
    if (orderResult.error && missingBuyerColumn(orderResult.error.message)) {
      orderResult = await ctx.supabaseAdmin
        .from("orders")
        .select("id, platetaker_id, seller_id")
        .eq("id", orderId)
        .maybeSingle();
    }
    const order = orderResult.data;

    if (orderResult.error || !order) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Order not found",
      });
    }

    if (orderBuyerId(order) !== userId && order.seller_id !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not part of this order conversation",
      });
    }

    const { data: messages, error } = await ctx.supabase
      .from("order_messages")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch messages:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch messages",
      });
    }

    return (messages || []).map((m) => ({
      id: m.id,
      orderId: m.order_id,
      senderId: m.sender_id,
      senderRole: m.sender_role as "platemaker" | "platetaker",
      text: m.text,
      createdAt: m.created_at,
    }));
  });
