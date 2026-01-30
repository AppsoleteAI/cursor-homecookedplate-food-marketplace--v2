import { protectedProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";
import { calculateOrderSplit } from "../../../../lib/fees";

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

    // CRITICAL: Always filter by seller_id = ctx.userId to ensure data isolation
    // Query all completed orders for this platemaker
    const { data: allOrders, error: ordersError } = await ctx.supabase
      .from('orders')
      .select('id, total_price, created_at')
      .eq('seller_id', ctx.userId) // Data isolation: only this platemaker's orders
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('[GetDashboardStats] Error fetching orders:', ordersError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch orders',
      });
    }

    // Handle edge case: no orders
    if (!allOrders || allOrders.length === 0) {
      return {
        totalRevenue: 0,
        takeHome: 0,
        todayRevenue: 0,
        todayTakeHome: 0,
        weekRevenue: 0,
        weekTakeHome: 0,
        orderCount: 0,
        todayOrderCount: 0,
        weekOrderCount: 0,
      };
    }

    // Calculate date boundaries
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    
    // Start of week (Monday)
    const startOfWeek = new Date(startOfToday);
    const dayOfWeek = startOfToday.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0, so 6 days back
    startOfWeek.setDate(startOfToday.getDate() - daysToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    // Initialize accumulators
    let totalRevenue = 0;
    let totalTakeHome = 0;
    let todayRevenue = 0;
    let todayTakeHome = 0;
    let weekRevenue = 0;
    let weekTakeHome = 0;
    let todayOrderCount = 0;
    let weekOrderCount = 0;

    // Process each order
    for (const order of allOrders) {
      const orderDate = new Date(order.created_at);
      const orderTotalPrice = parseFloat(order.total_price.toString());

      // Skip invalid orders
      if (!Number.isFinite(orderTotalPrice) || orderTotalPrice < 0) {
        console.warn('[GetDashboardStats] Skipping invalid order:', order.id, orderTotalPrice);
        continue;
      }

      // Calculate base amount (remove buyer fee: total_price includes 10% buyer fee)
      // Formula: total_price = baseAmount * 1.10, so baseAmount = total_price / 1.10
      const baseAmount = orderTotalPrice / 1.10;

      // Calculate take-home using calculateOrderSplit (90% of base after 10% seller fee)
      let orderTakeHome = 0;
      try {
        const split = calculateOrderSplit(baseAmount);
        orderTakeHome = split.sellerPayout; // This is baseAmount * 0.90
      } catch (error) {
        console.error('[GetDashboardStats] Error calculating take-home for order:', order.id, error);
        // Fallback: use baseAmount * 0.90 directly
        orderTakeHome = baseAmount * 0.90;
      }

      // Accumulate totals
      totalRevenue += orderTotalPrice;
      totalTakeHome += orderTakeHome;

      // Check if order is from today
      if (orderDate >= startOfToday) {
        todayRevenue += orderTotalPrice;
        todayTakeHome += orderTakeHome;
        todayOrderCount++;
      }

      // Check if order is from this week
      if (orderDate >= startOfWeek) {
        weekRevenue += orderTotalPrice;
        weekTakeHome += orderTakeHome;
        weekOrderCount++;
      }
    }

    // Round to 2 decimal places for currency
    return {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      takeHome: parseFloat(totalTakeHome.toFixed(2)),
      todayRevenue: parseFloat(todayRevenue.toFixed(2)),
      todayTakeHome: parseFloat(todayTakeHome.toFixed(2)),
      weekRevenue: parseFloat(weekRevenue.toFixed(2)),
      weekTakeHome: parseFloat(weekTakeHome.toFixed(2)),
      orderCount: allOrders.length,
      todayOrderCount,
      weekOrderCount,
    };
  });
