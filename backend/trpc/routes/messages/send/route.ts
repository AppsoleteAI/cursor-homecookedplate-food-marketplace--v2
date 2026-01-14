import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";

export const sendMessageProcedure = protectedProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      text: z.string().min(1).max(1000),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { orderId, text } = input;
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

    const { data: order, error: orderError } = await ctx.supabase
      .from("orders")
      .select("id, buyer_id, seller_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Order not found",
      });
    }

    if (order.buyer_id !== userId && order.seller_id !== userId) {
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

    return {
      id: message.id,
      orderId: message.order_id,
      senderId: message.sender_id,
      senderRole: message.sender_role,
      text: message.text,
      createdAt: message.created_at,
    };
  });
