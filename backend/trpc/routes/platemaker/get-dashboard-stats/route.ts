import { protectedProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";
import { sellerTakeHome } from "../../../../lib/fees";
import { orderListFilterAfterError, orderTotal, type OrderListFilter } from "../../../../lib/order-row";
import { confirmedPaidIds } from "../../../../lib/order-payment";

/**
 * Get Dashboard Stats Procedure
 * 
 * Calculates accurate dashboard statistics (earnings, take-home, order counts) for platemakers.
 * Uses the correct "Double 10" fee structure from backend/lib/fees.ts.
 * 
 * SECURITY:
 * - Only platemakers can access this procedure (role verification)
 * - Each platemaker only sees their own data (seller_id = ctx.userId)
 * - Platetakers (buyers) cannot access financial calculations
 */
export const getDashboardStatsProcedure = protectedProcedure
  .query(async ({ ctx }) => {
    // CRITICAL SECURITY: Verify user role is 'platemaker' before proceeding
    const { data: profile, error: profileError } = await ctx.supabase
      .from('profiles')
      .select('role')
      .eq('id', ctx.userId)
      .single();

    if (profileError || !profile) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch user profile',
      });
    }

    if (profile.role !== 'platemaker') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Dashboard statistics are only available to platemakers',
      });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday);
    const dayOfWeek = startOfToday.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(startOfToday.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const completedTotals = async (since?: string) => {
      const load = (filter: OrderListFilter) => {
        let listed = ctx.supabase
          .from('orders')
          .select(filter.columns)
          .eq(filter.cookColumn, ctx.userId)
          .eq('status', 'completed');
        if (filter.requirePaid) listed = listed.eq('paid', true);
        if (since) listed = listed.gte('created_at', since);
        return listed;
      };
      let filter: OrderListFilter = {
        cookColumn: 'seller_id',
        requirePaid: true,
        buyerColumn: 'buyer_id',
        columns: 'id, total_price, total_price_cents, paid, payment_intent_id',
      };
      let listed = await load(filter);
      for (let attempt = 0; attempt < 6 && listed.error; attempt += 1) {
        const next = orderListFilterAfterError(filter, listed.error.message);
        if (!next) break;
        filter = next;
        listed = await load(filter);
      }
      if (listed.error) {
        console.error('[GetDashboardStats] Error fetching orders:', listed.error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch orders',
        });
      }
      let rows = (listed.data || []) as unknown as { id: string; total_price?: unknown; total_price_cents?: unknown; paid?: boolean | null; payment_intent_id?: string | null }[];
      if (!filter.requirePaid) {
        const stripeSecret = ctx.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
        const paidIds = await confirmedPaidIds(rows, ctx.supabaseAdmin, stripeSecret);
        rows = rows.filter((order) => paidIds.has(order.id));
      }
      let revenue = 0;
      let count = 0;
      for (const order of rows) {
        const amount = orderTotal(order);
        if (!Number.isFinite(amount) || amount < 0) continue;
        revenue += amount;
        count += 1;
      }
      return { revenue, count };
    };

    const [allTime, week, today] = await Promise.all([
      completedTotals(),
      completedTotals(startOfWeek.toISOString()),
      completedTotals(startOfToday.toISOString()),
    ]);

    return {
      totalRevenue: Number(allTime.revenue.toFixed(2)),
      takeHome: sellerTakeHome(allTime.revenue),
      todayRevenue: Number(today.revenue.toFixed(2)),
      todayTakeHome: sellerTakeHome(today.revenue),
      weekRevenue: Number(week.revenue.toFixed(2)),
      weekTakeHome: sellerTakeHome(week.revenue),
      orderCount: allTime.count,
      todayOrderCount: today.count,
      weekOrderCount: week.count,
    };
  });
