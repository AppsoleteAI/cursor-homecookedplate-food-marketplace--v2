import { protectedProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";
import { sellerTakeHome } from "../../../../lib/fees";

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
      let aggregate = ctx.supabase
        .from('orders')
        .select('total_price.sum(),id.count()')
        .eq('seller_id', ctx.userId)
        .eq('status', 'completed');
      if (since) aggregate = aggregate.gte('created_at', since);
      const summed = await aggregate;
      const row = (Array.isArray(summed.data) ? summed.data[0] : summed.data) as { sum?: number | string | null; count?: number | string | null } | null;
      if (!summed.error && row && (row.sum !== undefined || row.count !== undefined)) {
        const revenue = Number(row.sum ?? 0);
        const count = Number(row.count ?? 0);
        return {
          revenue: Number.isFinite(revenue) && revenue > 0 ? revenue : 0,
          count: Number.isFinite(count) && count > 0 ? count : 0,
        };
      }

      let listed = ctx.supabase
        .from('orders')
        .select('total_price')
        .eq('seller_id', ctx.userId)
        .eq('status', 'completed');
      if (since) listed = listed.gte('created_at', since);
      const { data, error } = await listed;
      if (error) {
        console.error('[GetDashboardStats] Error fetching orders:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch orders',
        });
      }
      let revenue = 0;
      let count = 0;
      for (const order of data || []) {
        const amount = parseFloat(String(order.total_price));
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
