import { TRPCError } from '@trpc/server';
import { protectedProcedure } from '../../../create-context';
import { orderListFilterAfterError, writeOrderPatch, type OrderListFilter } from '../../../../lib/order-row';
import { orderPaidState, orderPaymentConfirmed } from '../../../../lib/order-payment';
import { refundOpenCharge } from '../../../../lib/refund-card';
import { moveMetroHeadcount, undoMetroHeadcount } from '../../../../lib/metro-headcount';
import { unpackShopLines } from '../../../../lib/shop-fulfillment';
import { readAppleRenewalStatus } from '../../../../lib/apple-server';
import { cancelGoogleSubscription } from '../../../../lib/google-play';
import { missingStoreDateColumn } from '../../../../lib/store-membership';
import { appleDeletionBlock, googleMembershipCovers } from '../../../../lib/trial-access';

/**
 * Server-Side Account Deletion
 *
 * Required by Apple App Store Guideline 5.1.1(v) and applicable privacy law.
 * Permanently removes all PII associated with the requesting user:
 *   1. Cancels any active Stripe subscription (prevents future charges)
 *   2. Deletes user-uploaded media from Supabase Storage
 *   3. Anonymizes message content to preserve order history integrity
 *   4. Deletes meals, reviews, orders tied to the account
 *   5. Deletes the Supabase Auth user (cascades to the profiles row via FK)
 *   6. Logs the deletion event in audit_logs for compliance records
 */
export const deleteAccountProcedure = protectedProcedure
  .mutation(async ({ ctx }) => {
    const userId = ctx.userId;

    // ── 1. Fetch profile to obtain Stripe IDs and media references ──────────
    const profileColumns = 'stripe_subscription_id, stripe_customer_id, profile_image, role, metro_area, membership_tier, trial_ends_at, apple_original_transaction_id, apple_expires_at, apple_revoked_at, google_purchase_token, google_expires_at';
    let profileResult = await ctx.supabaseAdmin
      .from('profiles')
      .select(profileColumns)
      .eq('id', userId)
      .single();
    if (missingStoreDateColumn(profileResult.error)) {
      profileResult = await ctx.supabaseAdmin
        .from('profiles')
        .select('stripe_subscription_id, stripe_customer_id, profile_image, role, metro_area, membership_tier, trial_ends_at, apple_original_transaction_id, google_purchase_token')
        .eq('id', userId)
        .single();
    }
    const profile = profileResult.data;
    await assertStoreBillingWillStop(profile, ctx);

    // ── 2. Refund and close open paid orders before anything is removed ────
    await closeOpenOrders(ctx.supabaseAdmin, userId, ctx.stripeSecretKey);

    // ── 3. Cancel active Stripe subscription ────────────────────────────────
    const stripeSecretKey = ctx.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
    if (stripeSecretKey && profile?.stripe_subscription_id) {
      try {
        await fetch(
          `https://api.stripe.com/v1/subscriptions/${profile.stripe_subscription_id}/cancel`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${stripeSecretKey}` },
          }
        );
      } catch (err) {
        // Non-fatal: log but continue deletion
        console.error('[DeleteAccount] Stripe subscription cancel failed:', err);
      }
    }

    // ── 3. Delete profile image from Supabase Storage ───────────────────────
    if (profile?.profile_image) {
      try {
        // Extract the storage path from the public URL
        const url = new URL(profile.profile_image);
        const pathParts = url.pathname.split('/object/public/');
        if (pathParts.length === 2) {
          const [bucket, ...fileParts] = pathParts[1].split('/');
          const filePath = fileParts.join('/');
          await ctx.supabaseAdmin.storage.from(bucket).remove([filePath]);
        }
      } catch (err) {
        console.error('[DeleteAccount] Profile image removal failed:', err);
      }
    }

    // ── 4. Delete meals and their associated media ───────────────────────────
    const { data: meals } = await ctx.supabaseAdmin
      .from('meals')
      .select('id, images')
      .eq('user_id', userId);

    if (meals && meals.length > 0) {
      for (const meal of meals) {
        for (const mediaUrl of meal.images || []) {
          if (mediaUrl) {
            try {
              const url = new URL(mediaUrl);
              const pathParts = url.pathname.split('/object/public/');
              if (pathParts.length === 2) {
                const [bucket, ...fileParts] = pathParts[1].split('/');
                await ctx.supabaseAdmin.storage
                  .from(bucket)
                  .remove([fileParts.join('/')]);
              }
            } catch {
              // Continue on media removal errors
            }
          }
        }
      }

      await ctx.supabaseAdmin
        .from('meals')
        .delete()
        .eq('user_id', userId);
    }

    const { data: attachments } = await ctx.supabaseAdmin
      .from('media_attachments')
      .select('storage_path')
      .eq('user_id', userId);

    if (attachments && attachments.length > 0) {
      const paths = attachments.map((row) => row.storage_path).filter(Boolean);
      if (paths.length > 0) {
        await ctx.supabaseAdmin.storage.from('meal-media').remove(paths);
      }
    }

    // ── 5. Anonymize messages (preserves order thread structure) ────────────
    await ctx.supabaseAdmin
      .from('order_messages')
      .update({ text: '[deleted]' })
      .eq('sender_id', userId);

    // ── 6. Delete reviews authored by this user ──────────────────────────────
    await ctx.supabaseAdmin
      .from('reviews')
      .delete()
      .eq('author_id', userId);

    // ── 7. Log deletion in audit_logs before removing the user ──────────────
    try {
      await ctx.supabaseAdmin.from('audit_logs').insert({
        user_id: userId,
        action: 'ACCOUNT_DELETED',
        table_name: 'profiles',
        record_id: userId,
        new_data: {
          reason: 'user_requested',
          stripe_subscription_cancelled: !!profile?.stripe_subscription_id,
        },
      });
    } catch (err) {
      console.error('[DeleteAccount] Audit log insert failed:', err);
    }

    let headcount: { blocked: boolean };
    try {
      headcount = await moveMetroHeadcount(ctx.supabaseAdmin, profile?.role, profile?.metro_area, 'Remote/Other');
    } catch {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This account was not deleted.' });
    }
    if (headcount.blocked) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'This account was not deleted.' });
    }

    // ── 8. Delete the Supabase Auth user (cascades to profiles row via FK) ──
    const { error: authDeleteError } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      await undoMetroHeadcount(ctx.supabaseAdmin, profile?.role, profile?.metro_area, 'Remote/Other');
      console.error('[DeleteAccount] Auth user deletion failed:', authDeleteError.message);
      throw new Error('Account deletion failed. Please contact support.');
    }

    return { success: true };
  });

async function assertStoreBillingWillStop(
  profile: {
    apple_original_transaction_id?: string | null;
    apple_expires_at?: string | null;
    apple_revoked_at?: string | null;
    google_purchase_token?: string | null;
    google_expires_at?: string | null;
    membership_tier?: string | null;
    role?: string | null;
    trial_ends_at?: string | null;
    stripe_subscription_id?: string | null;
  } | null,
  ctx: {
    appleApi: { keyId?: string; issuerId?: string; privateKey?: string };
    googlePlayServiceAccountJson?: string;
  },
): Promise<void> {
  if (profile?.apple_original_transaction_id) {
    let status;
    try {
      status = await readAppleRenewalStatus(profile.apple_original_transaction_id, ctx.appleApi);
    } catch {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'The App Store subscription could not be checked. This account was not deleted.',
      });
    }
    const block = appleDeletionBlock(profile, status);
    if (block) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: block });
    }
  }

  if (profile?.google_purchase_token) {
    if (!ctx.googlePlayServiceAccountJson) {
      if (googleMembershipCovers(profile)) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Cancel the Google Play subscription before this account can be deleted. HomeCookedPlate could not confirm that Google has stopped renewal.',
        });
      }
      return;
    }
    try {
      await cancelGoogleSubscription(profile.google_purchase_token, {
        serviceAccountJson: ctx.googlePlayServiceAccountJson,
      });
    } catch (error) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: error instanceof Error && /Google Play subscription/i.test(error.message)
          ? `${error.message} This account was not deleted.`
          : 'The Google Play subscription could not be cancelled. This account was not deleted.',
      });
    }
  }
}

const OPEN_STATUSES = ['pending', 'accepted', 'preparing', 'ready'];

async function closeOpenOrders(
  admin: { from: (table: string) => any },
  userId: string,
  stripeSecretKey: string | undefined,
): Promise<void> {
  let filter: OrderListFilter = {
    cookColumn: 'seller_id',
    requirePaid: false,
    buyerColumn: 'buyer_id',
    columns: 'id, paid, payment_intent_id, status',
  };
  const load = (current: OrderListFilter) => admin
    .from('orders')
    .select(current.columns)
    .or(`${current.buyerColumn}.eq.${userId},${current.cookColumn}.eq.${userId}`)
    .in('status', OPEN_STATUSES);

  let orders = await load(filter);
  for (let attempt = 0; attempt < 6 && orders.error; attempt += 1) {
    const next = orderListFilterAfterError(filter, orders.error.message);
    if (!next) break;
    filter = next;
    orders = await load(filter);
  }
  if (orders.error) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Open orders could not be closed. This account was not deleted.' });
  }

  const asBuyer = await admin.from('shop_orders').select('id, paid, payment_intent_id, lines, buyer_id').eq('buyer_id', userId).eq('paid', true);
  const asSeller = await admin.from('shop_orders').select('id, paid, payment_intent_id, lines, buyer_id').eq('paid', true).filter('lines->>sellerId', 'eq', userId);
  const shopError = asBuyer.error || asSeller.error;
  if (shopError && /shop_orders/i.test(shopError.message) && /does not exist|schema cache/i.test(shopError.message)) {
    asBuyer.data = [];
    asSeller.data = [];
  } else if (shopError) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Open shop orders could not be closed. This account was not deleted.' });
  }
  const shopRows = [...(asBuyer.data ?? []), ...(asSeller.data ?? [])].filter((row: { id: string; lines: unknown; buyer_id: string }) => {
    const unpacked = unpackShopLines(row.lines);
    return (row.buyer_id === userId || unpacked.sellerId === userId)
      && unpacked.status !== 'completed'
      && unpacked.status !== 'cancelled';
  });
  const closingOrderIds = new Set<string>(((orders.data ?? []) as { id: string }[]).map((order) => order.id));
  const closingShopIds = new Set<string>(shopRows.map((row: { id: string }) => row.id));
  const refunded = new Set<string>();
  for (const order of orders.data ?? []) {
    const intent = order.payment_intent_id as string | null;
    const paid = orderPaidState(order) === 'paid'
      || (orderPaidState(order) === 'absent' && await orderPaymentConfirmed(order, admin, stripeSecretKey));
    if (paid && intent && !refunded.has(intent)) {
      await assertChargeBelongsToClosing(admin, intent, closingOrderIds, closingShopIds);
      if (!stripeSecretKey) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'The card refund could not be started. This account was not deleted.' });
      }
      try {
        await refundOpenCharge(stripeSecretKey, intent);
      } catch (error) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: error instanceof Error ? error.message : 'The card refund did not go through. This account was not deleted.',
        });
      }
      refunded.add(intent);
    }
    const closed = await writeOrderPatch(
      (patch) => admin.from('orders').update(patch).eq('id', order.id),
      { status: 'cancelled', paid: false },
    );
    if (closed.error) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'An open order could not be closed. This account was not deleted.' });
    }
    if (paid) {
      await admin.from('transactions').update({ status: 'refunded' }).eq('order_id', order.id).eq('status', 'held');
    }
  }

  for (const row of shopRows) {
    const intent = row.payment_intent_id as string | null;
    if (intent && !refunded.has(intent)) {
      await assertChargeBelongsToClosing(admin, intent, closingOrderIds, closingShopIds);
      if (!stripeSecretKey) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'The card refund could not be started. This account was not deleted.' });
      }
      try {
        await refundOpenCharge(stripeSecretKey, intent);
      } catch (error) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: error instanceof Error ? error.message : 'The card refund did not go through. This account was not deleted.',
        });
      }
      refunded.add(intent);
    }
    const lines = row.lines && typeof row.lines === 'object' && !Array.isArray(row.lines)
      ? { ...row.lines, status: 'cancelled' }
      : row.lines;
    const closed = await admin.from('shop_orders').update({ lines }).eq('id', row.id);
    if (closed.error) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'An open shop order could not be closed. This account was not deleted.' });
    }
  }
}

async function assertChargeBelongsToClosing(
  admin: { from: (table: string) => any },
  paymentIntentId: string,
  closingOrderIds: Set<string>,
  closingShopIds: Set<string>,
): Promise<void> {
  const plates = await admin.from('orders').select('id').eq('payment_intent_id', paymentIntentId);
  const shops = await admin.from('shop_orders').select('id').eq('payment_intent_id', paymentIntentId);
  const plateIds = (plates.data ?? []).map((row: { id: string }) => row.id);
  if (shops.error && !/does not exist|schema cache/i.test(shops.error.message)) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'An open charge could not be checked. This account was not deleted.' });
  }
  const shopIds = shops.error ? [] : (shops.data ?? []).map((row: { id: string }) => row.id);
  const platesFit = plateIds.every((id: string) => closingOrderIds.has(id));
  const shopsFit = shopIds.every((id: string) => closingShopIds.has(id));
  if (!platesFit || !shopsFit) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'An open charge is shared with another order. This account was not deleted.',
    });
  }
}
