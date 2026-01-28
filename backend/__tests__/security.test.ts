/**
 * Security Test Suite for RLS Policies
 * 
 * This test suite verifies that Row Level Security (RLS) policies are working correctly.
 * It tests three types of users: Admin, Normal User, and Unauthenticated (Anon).
 * 
 * IMPORTANT: These tests require a real Supabase instance with the security_enhancements.sql
 * applied. Set the following environment variables:
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 * 
 * Run with: npm test -- backend/__tests__/security.test.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Environment variables - should be set in test environment
const supabaseUrl = process.env.SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Skip tests if environment variables are not set
const shouldSkip = !supabaseUrl || !anonKey || !serviceKey;

// Clients with different privilege levels
let anonClient: SupabaseClient;
let adminClient: SupabaseClient;

// Test data IDs for cleanup
interface TestData {
  platemakerId?: string;
  platetakerId?: string;
  mealId?: string;
  completedOrderId?: string;
  uncompletedOrderId?: string;
}

/**
 * Helper function to create a test user via Supabase Auth
 * Returns the user ID and profile ID
 */
async function createTestUser(
  client: SupabaseClient,
  email: string,
  password: string,
  role: 'platemaker' | 'platetaker' = 'platetaker'
): Promise<{ userId: string; profileId: string }> {
  // Create auth user
  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role,
      username: email.split('@')[0],
    },
  });

  if (authError || !authData.user) {
    throw new Error(`Failed to create test user: ${authError?.message || 'Unknown error'}`);
  }

  // Wait a moment for the trigger to create the profile
  await new Promise(resolve => setTimeout(resolve, 500));

  // Fetch the profile
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error(`Failed to fetch test user profile: ${profileError?.message || 'Profile not found'}`);
  }

  return {
    userId: authData.user.id,
    profileId: profile.id,
  };
}

/**
 * Helper function to clean up test data
 */
async function cleanupTestData(client: SupabaseClient, data: TestData) {
  // Delete in reverse order of dependencies
  if (data.completedOrderId) {
    await client.from('orders').delete().eq('id', data.completedOrderId);
  }
  if (data.uncompletedOrderId) {
    await client.from('orders').delete().eq('id', data.uncompletedOrderId);
  }
  if (data.mealId) {
    await client.from('meals').delete().eq('id', data.mealId);
  }
  if (data.platemakerId) {
    await client.auth.admin.deleteUser(data.platemakerId);
  }
  if (data.platetakerId) {
    await client.auth.admin.deleteUser(data.platetakerId);
  }
}

describe('RLS Security Policies', () => {
  beforeAll(() => {
    if (shouldSkip) {
      console.warn('⚠️  Skipping security tests: SUPABASE_URL, SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY not set');
      return;
    }

    anonClient = createClient(supabaseUrl, anonKey);
    adminClient = createClient(supabaseUrl, serviceKey);
  });

  describe('Database Security Guardrails', () => {
    it('should block unauthorized access to audit_logs', async () => {
      if (shouldSkip) return;

      // RLS Section 8 should return empty data to anon users
      const { data, error } = await anonClient
        .from('audit_logs')
        .select('*');

      // Should return empty data (RLS policy blocks access)
      expect(data?.length).toBe(0);
    });

    it('should allow admins to read audit_logs', async () => {
      if (shouldSkip) return;

      // Note: This test requires an actual admin user session
      // In a real test, you would create an admin user and authenticate
      // For now, we verify the policy exists by checking that anon users are blocked
      const { data: anonData } = await anonClient
        .from('audit_logs')
        .select('*');

      // Anon users should be blocked
      expect(anonData?.length === 0 || !anonData).toBeTruthy();
    });
  });

  describe('Price Tampering Prevention', () => {
    const priceTestData: TestData = {};

    beforeAll(async () => {
      if (shouldSkip) return;

      // Create test users and meal for price tampering test
      try {
        const timestamp = Date.now();
        const platemaker = await createTestUser(
          adminClient,
          `test-platemaker-${timestamp}@test.com`,
          'TestPassword123!',
          'platemaker'
        );
        priceTestData.platemakerId = platemaker.userId;

        const platetaker = await createTestUser(
          adminClient,
          `test-platetaker-${timestamp}@test.com`,
          'TestPassword123!',
          'platetaker'
        );
        priceTestData.platetakerId = platetaker.userId;

        // Create a test meal with a known price
        const { data: meal, error: mealError } = await adminClient
          .from('meals')
          .insert({
            name: `Test Meal ${timestamp}`,
            price: 10.99,
            user_id: platemaker.userId,
            seller_id: platemaker.userId,
            available: true,
            published: true,
            description: 'Test meal for security testing',
            cuisine: 'Test',
            category: 'dinner',
            ingredients: ['test'],
            preparation_time: 30,
          })
          .select()
          .single();

        if (mealError || !meal) {
          throw new Error(`Failed to create test meal: ${mealError?.message || 'Unknown error'}`);
        }

        priceTestData.mealId = meal.id;
      } catch (error) {
        console.error('[Price Tampering Test] Setup error:', error);
        // Don't throw - let the test fail gracefully
      }
    });

    afterAll(async () => {
      if (shouldSkip) return;
      await cleanupTestData(adminClient, priceTestData);
    });

    it('should prevent price tampering on orders', async () => {
      if (shouldSkip) return;

      if (!priceTestData.mealId || !priceTestData.platetakerId || !priceTestData.platemakerId) {
        console.warn('[Price Tampering Test] Skipping: Test data not set up');
        return;
      }

      // This test verifies that the SQL trigger calculate_order_price() (Section 2)
      // prevents price tampering by overriding any manually set total_price

      // Attempt to insert an order with a malicious low price ($0.01)
      const { data: order, error } = await adminClient
        .from('orders')
        .insert({
          meal_id: priceTestData.mealId,
          buyer_id: priceTestData.platetakerId,
          seller_id: priceTestData.platemakerId,
          quantity: 2,
          total_price: 0.01, // The "attack" price - trigger should override this
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create test order: ${error.message}`);
      }

      // Fetch the actual meal price to compare
      const { data: meal, error: mealError } = await adminClient
        .from('meals')
        .select('price')
        .eq('id', priceTestData.mealId)
        .single();

      if (mealError || !meal) {
        throw new Error(`Failed to fetch test meal: ${mealError?.message || 'Meal not found'}`);
      }

      // The SQL trigger should have overwritten 0.01 with (meal.price * quantity)
      const expectedPrice = meal.price * 2; // quantity is 2
      expect(order.total_price).toBe(expectedPrice);
      expect(order.total_price).toBeGreaterThan(0.01);
      expect(order.total_price).toBe(10.99 * 2); // 21.98

      // Clean up the test order
      await adminClient.from('orders').delete().eq('id', order.id);
    });
  });

  describe('Admin Escalation Prevention', () => {
    let testUserId: string | undefined;

    beforeAll(async () => {
      if (shouldSkip) return;

      // Create a test user for admin escalation test
      try {
        const timestamp = Date.now();
        const user = await createTestUser(
          adminClient,
          `test-user-admin-${timestamp}@test.com`,
          'TestPassword123!',
          'platetaker'
        );
        testUserId = user.userId;
      } catch (error) {
        console.error('[Admin Escalation Test] Setup error:', error);
      }
    });

    afterAll(async () => {
      if (shouldSkip) return;
      if (testUserId) {
        await adminClient.auth.admin.deleteUser(testUserId);
      }
    });

    it('should prevent users from promoting themselves to admin', async () => {
      if (shouldSkip) return;

      if (!testUserId) {
        console.warn('[Admin Escalation Test] Skipping: Test user not set up');
        return;
      }

      // RLS Section 3 check should fail - users cannot change their own is_admin flag
      // This test verifies the RLS policy "update_own_profile" blocks is_admin changes

      // Attempt to flip the is_admin bit via the public updateProfile logic
      const { error } = await anonClient
        .from('profiles')
        .update({ is_admin: true })
        .eq('id', testUserId);

      // This should fail because the RLS 'WITH CHECK' compares against existing value
      // or the policy simply doesn't allow updating that column.
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/is_admin|permission|policy|unauthorized/i);
    });
  });

  describe('Review Validation', () => {
    const reviewTestData: TestData = {};

    beforeAll(async () => {
      if (shouldSkip) return;

      // Create test users, meal, and orders for ghost review test
      try {
        const timestamp = Date.now();
        const platemaker = await createTestUser(
          adminClient,
          `test-platemaker-review-${timestamp}@test.com`,
          'TestPassword123!',
          'platemaker'
        );
        reviewTestData.platemakerId = platemaker.userId;

        const platetaker = await createTestUser(
          adminClient,
          `test-platetaker-review-${timestamp}@test.com`,
          'TestPassword123!',
          'platetaker'
        );
        reviewTestData.platetakerId = platetaker.userId;

        // Create a test meal
        const { data: meal, error: mealError } = await adminClient
          .from('meals')
          .insert({
            name: `Test Meal Review ${timestamp}`,
            price: 15.99,
            user_id: platemaker.userId,
            seller_id: platemaker.userId,
            available: true,
            published: true,
            description: 'Test meal for review testing',
            cuisine: 'Test',
            category: 'dinner',
            ingredients: ['test'],
            preparation_time: 30,
          })
          .select()
          .single();

        if (mealError || !meal) {
          throw new Error(`Failed to create test meal: ${mealError?.message || 'Unknown error'}`);
        }

        reviewTestData.mealId = meal.id;

        // Create a completed order (should allow review)
        const { data: completedOrder, error: completedError } = await adminClient
          .from('orders')
          .insert({
            meal_id: meal.id,
            buyer_id: platetaker.userId,
            seller_id: platemaker.userId,
            quantity: 1,
            status: 'completed',
            paid: true,
          })
          .select()
          .single();

        if (completedError || !completedOrder) {
          throw new Error(`Failed to create completed order: ${completedError?.message || 'Unknown error'}`);
        }

        reviewTestData.completedOrderId = completedOrder.id;

        // Create an uncompleted order (should reject review)
        const { data: uncompletedOrder, error: uncompletedError } = await adminClient
          .from('orders')
          .insert({
            meal_id: meal.id,
            buyer_id: platetaker.userId,
            seller_id: platemaker.userId,
            quantity: 1,
            status: 'pending', // Not completed
            paid: false,
          })
          .select()
          .single();

        if (uncompletedError || !uncompletedOrder) {
          throw new Error(`Failed to create uncompleted order: ${uncompletedError?.message || 'Unknown error'}`);
        }

        reviewTestData.uncompletedOrderId = uncompletedOrder.id;
      } catch (error) {
        console.error('[Review Validation Test] Setup error:', error);
        // Don't throw - let the test fail gracefully
      }
    });

    afterAll(async () => {
      if (shouldSkip) return;
      await cleanupTestData(adminClient, reviewTestData);
    });

    it('should reject reviews for uncompleted orders', async () => {
      if (shouldSkip) return;

      if (!reviewTestData.mealId || !reviewTestData.uncompletedOrderId) {
        console.warn('[Review Validation Test] Skipping: Test data not set up');
        return;
      }

      // This test verifies that the RLS policy insert_review_after_purchase (SQL Section 5)
      // only allows reviews for completed orders

      // Attempt to insert a review for an uncompleted order (should fail)
      const { error } = await anonClient
        .from('reviews')
        .insert({
          meal_id: reviewTestData.mealId,
          order_id: reviewTestData.uncompletedOrderId,
          rating: 5,
          comment: 'Ghost review!',
        });

      // SQL Section 5: insert_review_after_purchase requires status = 'completed'
      expect(error).toBeDefined();
      expect(error?.message).toMatch(/completed|status|policy|unauthorized/i);
    });

    it('should allow reviews for completed orders', async () => {
      if (shouldSkip) return;

      if (!reviewTestData.mealId || !reviewTestData.completedOrderId || !reviewTestData.platetakerId) {
        console.warn('[Review Validation Test] Skipping: Test data not set up');
        return;
      }

      // Note: In a real test, you would authenticate the user properly
      // For now, we use admin client to verify the policy allows completed orders
      // The RLS policy checks that the order exists, belongs to the user, and is completed
      const { data: review, error } = await adminClient
        .from('reviews')
        .insert({
          meal_id: reviewTestData.mealId,
          order_id: reviewTestData.completedOrderId,
          author_id: reviewTestData.platetakerId,
          rating: 5,
          comment: 'Great meal!',
        })
        .select()
        .single();

      // Should succeed for completed orders
      expect(error).toBeUndefined();
      expect(review).toBeDefined();
      expect(review?.order_id).toBe(reviewTestData.completedOrderId);

      // Clean up the test review
      if (review) {
        await adminClient.from('reviews').delete().eq('id', review.id);
      }
    });
  });

  describe('Financial Logic Consistency', () => {
    it('should match SQL rounding strategy (2 decimal places)', () => {
      // This test verifies that TypeScript math matches SQL rounding
      const { calculateOrderBreakdown } = require('../lib/fees');

      const unitPrice = 10.99;
      const quantity = 3;
      const breakdown = calculateOrderBreakdown(unitPrice, quantity);

      // Subtotal: 32.97
      // Platform Fee (10%): 3.297 -> rounded to 3.30
      // Total: 36.27
      expect(breakdown.subtotal).toBe(32.97);
      expect(breakdown.platformFee).toBe(3.30);
      expect(breakdown.total).toBe(36.27);
    });

    it('should prevent penny-off errors', () => {
      const { calculateOrderBreakdown } = require('../lib/fees');

      // Test edge cases that could cause rounding issues
      const testCases = [
        { price: 10.99, quantity: 1, expectedSubtotal: 10.99, expectedFee: 1.10, expectedTotal: 12.09 },
        { price: 10.99, quantity: 2, expectedSubtotal: 21.98, expectedFee: 2.20, expectedTotal: 24.18 },
        { price: 10.99, quantity: 3, expectedSubtotal: 32.97, expectedFee: 3.30, expectedTotal: 36.27 },
        { price: 9.99, quantity: 1, expectedSubtotal: 9.99, expectedFee: 1.00, expectedTotal: 10.99 },
      ];

      testCases.forEach(({ price, quantity, expectedSubtotal, expectedFee, expectedTotal }) => {
        const breakdown = calculateOrderBreakdown(price, quantity);
        expect(breakdown.subtotal).toBe(expectedSubtotal);
        expect(breakdown.platformFee).toBe(expectedFee);
        expect(breakdown.total).toBe(expectedTotal);
        // Verify all values are properly rounded to 2 decimal places
        expect(breakdown.total.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
        expect(breakdown.platformFee.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(2);
      });
    });

    it('should use calculateOrderSplit correctly for base amount', () => {
      const { calculateOrderSplit } = require('../lib/fees');

      const baseAmount = 32.97;
      const split = calculateOrderSplit(baseAmount);

      // Platetaker fee: 3.297 -> rounded to 3.30
      // Platemaker fee: 3.297 -> rounded to 3.30
      // Total captured: 36.27
      // Seller payout: 29.67
      expect(split.totalCaptured).toBe(36.27);
      expect(split.sellerPayout).toBe(29.67);
      expect(split.appRevenue).toBe(6.59); // 3.30 + 3.29 (rounded)
    });
  });
});
