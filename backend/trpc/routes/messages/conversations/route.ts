import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";
import { loadPublicProfiles } from "../../../../lib/public-profiles";
import { orderBuyerId, orderCookId, orderListColumns, orderListFilterAfterError, type OrderListFilter } from "../../../../lib/order-row";
import { messageVisible, missingColumn } from "../../../../lib/content-moderation";
import { firstPlatePhoto } from "@/lib/food-review-clips";
import { hiddenClipVideoAddresses, hiddenMealImages, visiblePlateMedia } from "../../../../lib/hidden-clips";

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

    const loadOrders = (filter: OrderListFilter) => {
      const query = ctx.supabaseAdmin
        .from("orders")
        .select(`${filter.columns}, meals!inner(id, name, images)`)
        .order("created_at", { ascending: false });
      return userRole === "platemaker" ? query.eq(filter.cookColumn, userId) : query.eq(filter.buyerColumn, userId);
    };

    let filter: OrderListFilter = {
      cookColumn: "seller_id",
      requirePaid: false,
      buyerColumn: "buyer_id",
      columns: orderListColumns("buyer_id"),
    };
    let orderResult = await loadOrders(filter);
    for (let attempt = 0; attempt < 6 && orderResult.error; attempt += 1) {
      const next = orderListFilterAfterError(filter, orderResult.error.message);
      if (!next) break;
      filter = next;
      orderResult = await loadOrders(filter);
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

    const orderRows = orders as any[];
    const orderIds = orderRows.map((o) => o.id);

    let messagesResult = await ctx.supabase
      .from("order_messages")
      .select("order_id, text, created_at, sender_id, moderation_status")
      .in("order_id", orderIds)
      .order("created_at", { ascending: false });
    if (messagesResult.error && missingColumn(messagesResult.error.message, 'moderation_status')) {
      messagesResult = await ctx.supabase
        .from("order_messages")
        .select("order_id, text, created_at, sender_id")
        .in("order_id", orderIds)
        .order("created_at", { ascending: false }) as typeof messagesResult;
    }
    const messages = messagesResult.data;
    const messagesError = messagesResult.error;

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
      if (!messageVisible(msg.moderation_status, msg.sender_id, userId)) continue;
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
      orderRows.flatMap((o) => [orderBuyerId(o), orderCookId(o)])
    );

    const mealIdOf = (meals: { id?: string } | { id?: string }[] | null | undefined) => {
      if (!meals) return "";
      return Array.isArray(meals) ? meals[0]?.id || "" : meals.id || "";
    };
    const hiddenVideos = await hiddenClipVideoAddresses(ctx.supabaseAdmin);
    const hiddenStills = await hiddenMealImages(ctx.supabaseAdmin, orderRows.map((order) => mealIdOf(order.meals as { id?: string } | { id?: string }[] | null)));
    return orderRows.map((order) => {
      const buyerId = orderBuyerId(order);
      const otherUserId = userRole === "platemaker" ? buyerId : orderCookId(order);
      const otherUser = profiles.get(otherUserId);
      const latestMessage = latestMessageByOrder[order.id];

      return {
        orderId: order.id,
        mealName: (order.meals as any)?.name || "Unknown Meal",
        mealImage: firstPlatePhoto(visiblePlateMedia((order.meals as { images?: string[] } | null)?.images, hiddenStills.get(mealIdOf(order.meals as { id?: string } | { id?: string }[] | null)), hiddenVideos)),
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
