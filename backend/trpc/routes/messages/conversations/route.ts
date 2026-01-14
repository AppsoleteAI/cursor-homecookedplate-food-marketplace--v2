import { protectedProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";

export const listConversationsProcedure = protectedProcedure.query(
  async ({ ctx }) => {
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

    const orderFilter =
      userRole === "platemaker"
        ? { seller_id: userId }
        : { buyer_id: userId };

    const { data: orders, error: ordersError } = await ctx.supabase
      .from("orders")
      .select(
        `
        id,
        buyer_id,
        seller_id,
        status,
        created_at,
        meals!inner(id, name, images)
      `
      )
      .match(orderFilter)
      .order("created_at", { ascending: false });

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

    const { data: profiles, error: profilesError } = await ctx.supabase
      .from("profiles")
      .select("id, username, profile_image")
      .in(
        "id",
        orders.flatMap((o) => [o.buyer_id, o.seller_id])
      );

    if (profilesError) {
      console.error("Failed to fetch profiles:", profilesError);
    }

    const profilesMap = new Map(
      (profiles || []).map((p) => [p.id, { username: p.username, profileImage: p.profile_image }])
    );

    return orders.map((order) => {
      const otherUserId =
        userRole === "platemaker" ? order.buyer_id : order.seller_id;
      const otherUser = profilesMap.get(otherUserId);
      const latestMessage = latestMessageByOrder[order.id];

      return {
        orderId: order.id,
        mealName: (order.meals as any)?.name || "Unknown Meal",
        mealImage: ((order.meals as any)?.images?.[0] as string) || "",
        otherUserId,
        otherUserName: otherUser?.username || "User",
        otherUserImage: otherUser?.profileImage,
        lastMessage: latestMessage?.text || "No messages yet",
        lastMessageDate: latestMessage?.createdAt || order.created_at,
        unread: latestMessage?.senderId !== userId && latestMessage?.senderId === otherUserId,
        orderStatus: order.status,
      };
    });
  }
);
