import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";
import { loadPublicProfiles } from "../../../../lib/public-profiles";
import { missingBuyerColumn, orderBuyerId } from "../../../../lib/order-row";

export const listConversationsProcedure = protectedProcedure
  .input(z.object({ asBuyer: z.boolean().optional() }).optional())
  .query(
  async ({ ctx, input }) => {
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

    const userRole = profile.role === "platemaker" && input?.asBuyer
      ? "platetaker"
      : profile.role as "platemaker" | "platetaker";

    const loadOrders = (buyerColumn: "buyer_id" | "platetaker_id") => {
      const query = ctx.supabaseAdmin
        .from("orders")
        .select(`id, ${buyerColumn}, seller_id, status, created_at, meals!inner(id, name, images)`)
        .order("created_at", { ascending: false });
      return userRole === "platemaker" ? query.eq("seller_id", userId) : query.eq(buyerColumn, userId);
    };

    let orderResult = await loadOrders("buyer_id");
    if (orderResult.error && missingBuyerColumn(orderResult.error.message)) {
      orderResult = await loadOrders("platetaker_id");
    }
    const orders = orderResult.data;
    const ordersError = orderResult.error;

    if (ordersError) {
      console.error("Failed to fetch orders:", ordersError);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch conversations",
      });
    }

    if (!orders || orders.length === 0) {
      return [];
    }

    const orderIds = orders.map((o) => o.id);

    const { data: messages, error: messagesError } = await ctx.supabase
      .from("order_messages")
      .select("order_id, text, created_at, sender_id")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false });

    if (messagesError) {
      console.error("Failed to fetch messages:", messagesError);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch messages",
      });
    }

    const latestMessageByOrder: Record<
      string,
      { text: string; createdAt: string; senderId: string }
    > = {};
    for (const msg of messages || []) {
      if (!latestMessageByOrder[msg.order_id]) {
        latestMessageByOrder[msg.order_id] = {
          text: msg.text,
          createdAt: msg.created_at,
          senderId: msg.sender_id,
        };
      }
    }

    const profiles = await loadPublicProfiles(
      ctx.supabaseAdmin,
      orders.flatMap((o) => [orderBuyerId(o), o.seller_id])
    );

    return orders.map((order) => {
      const buyerId = orderBuyerId(order);
      const otherUserId = userRole === "platemaker" ? buyerId : order.seller_id;
      const otherUser = profiles.get(otherUserId);
      const latestMessage = latestMessageByOrder[order.id];

      return {
        orderId: order.id,
        mealName: (order.meals as any)?.name || "Unknown Meal",
        mealImage: ((order.meals as any)?.images?.[0] as string) || "",
        otherUserId,
        otherUserName: otherUser?.username || "User",
        otherUserImage: otherUser?.profile_image,
        lastMessage: latestMessage?.text || "No messages yet",
        lastMessageDate: latestMessage?.createdAt || order.created_at,
        unread: latestMessage?.senderId !== userId && latestMessage?.senderId === otherUserId,
        orderStatus: order.status,
      };
    });
  }
);
