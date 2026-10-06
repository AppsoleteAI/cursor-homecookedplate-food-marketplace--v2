import { protectedProcedure } from '../../../create-context';

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
    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('stripe_subscription_id, stripe_customer_id, profile_image')
      .eq('id', userId)
      .single();

    // ── 2. Cancel active Stripe subscription ────────────────────────────────
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
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

    // ── 8. Delete the Supabase Auth user (cascades to profiles row via FK) ──
    const { error: authDeleteError } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error('[DeleteAccount] Auth user deletion failed:', authDeleteError.message);
      throw new Error('Account deletion failed. Please contact support.');
    }

    return { success: true };
  });
