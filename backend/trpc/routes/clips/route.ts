import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedProcedure, publicProcedure } from '../../create-context';
import { decode } from 'base64-arraybuffer';
import { mediaFrameSource, scanVideo } from '../../../lib/image-security';
import { mealVisibleInMetro } from '../../../lib/metro-menu';
import { platemakerMayEnter } from '../../../lib/trial-access';
import { foodReviewLinkClip } from '@/lib/food-review-clips';

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST205' || error.code === '42P01' || /food_review_clips/i.test(error.message ?? '') || /schema cache/i.test(error.message ?? '');
}

export const listClipsProcedure = publicProcedure
  .input(z.object({ metroArea: z.string().optional() }).optional())
  .query(async ({ input, ctx }) => {
  const profile = ctx.userId
    ? await ctx.supabaseAdmin.from('profiles').select('metro_area').eq('id', ctx.userId).maybeSingle()
    : { data: null };
  const savedMetro = typeof profile.data?.metro_area === 'string' ? profile.data.metro_area.trim() : '';
  const { data, error } = await ctx.supabaseAdmin
    .from('food_review_clips')
    .select('id, user_id, meal_name, author, role, video_url, poster_url, duration_seconds, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) {
    if (missingTable(error)) return [];
    console.error('[Clips] List failed:', error.message);
    return [];
  }
  const authorIds = [...new Set((data || []).map((row: { user_id?: string }) => row.user_id).filter(Boolean))];
  const metros = authorIds.length === 0
    ? { data: [] as { id: string; metro_area: string | null }[] }
    : await ctx.supabaseAdmin.from('profiles').select('id, metro_area').in('id', authorIds);
  const cookMetros = new Map<string, string | null>(
    (metros.data || []).map((row: { id: string; metro_area: string | null }) => [row.id, row.metro_area])
  );
  return (data || []).flatMap((row: {
    id: string;
    meal_name: string;
    author: string;
    role: 'platemaker' | 'platetaker';
    video_url: string;
    poster_url: string | null;
    duration_seconds: number;
    created_at: string;
    user_id?: string;
  }) => {
    if (!mealVisibleInMetro(cookMetros.get(row.user_id || ''), savedMetro || undefined)) return [];
    return [{
    id: row.id,
    mealName: row.meal_name,
    author: row.author,
    role: row.role,
    videoUri: row.video_url,
    posterUri: row.poster_url || '',
    durationSeconds: row.duration_seconds,
    createdAt: row.created_at,
    counts: { smile: 0, heart: 0, star: 0 },
    reactionsByUser: {},
  }];
  });
});

export const publishClipProcedure = protectedProcedure
  .input(z.object({
    mealName: z.string().min(1).max(80),
    base64Data: z.string().min(20),
    mimeType: z.string().min(3).max(80),
    durationSeconds: z.number().int().positive().max(20),
    posterUri: z.string().max(500).optional(),
  }))
  .mutation(async ({ input, ctx }) => {
    const { data: profile } = await ctx.supabaseAdmin
      .from('profiles')
      .select('username, role, membership_tier, trial_ends_at, stripe_subscription_id, apple_original_transaction_id, google_purchase_token')
      .eq('id', ctx.userId)
      .maybeSingle();
    const cookMayPost = profile?.role === 'platemaker' && platemakerMayEnter(profile);
    const buyerMayPost = profile?.role === 'platetaker' && profile.membership_tier === 'premium';
    if (!profile || (!cookMayPost && !buyerMayPost)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Posting a clip is for a premium membership.' });
    }

    const arrayBuffer = decode(input.base64Data);
    const scanResult = await scanVideo(
      arrayBuffer,
      input.mimeType,
      ctx.ai,
      ctx.media ? mediaFrameSource(ctx.media) : undefined,
    );
    if (!scanResult.allowed) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: scanResult.reason ?? 'That clip did not pass the video check.' });
    }

    const extension = input.mimeType.includes('quicktime') ? 'mov' : 'mp4';
    const fileName = `${ctx.userId}/clips/${Date.now()}.${extension}`;
    const uploaded = await ctx.supabaseAdmin.storage.from('meal-media').upload(fileName, arrayBuffer, {
      contentType: input.mimeType,
      upsert: false,
    });
    if (uploaded.error) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The clip could not be stored.' });
    }
    const publicUrl = ctx.supabaseAdmin.storage.from('meal-media').getPublicUrl(fileName).data.publicUrl;
    const id = `clip-${Date.now()}`;
    const role = profile.role === 'platemaker' ? 'platemaker' : 'platetaker';
    const { error } = await ctx.supabaseAdmin.from('food_review_clips').insert({
      id,
      user_id: ctx.userId,
      meal_name: input.mealName.trim(),
      author: profile.username || 'Cook',
      role,
      video_url: publicUrl,
      poster_url: input.posterUri?.startsWith('https://') ? input.posterUri : null,
      duration_seconds: input.durationSeconds,
    });
    if (error) {
      if (missingTable(error)) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The shared clip timeline is not on this kitchen yet.' });
      }
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The clip could not be posted.' });
    }
    return {
      id,
      mealName: input.mealName.trim(),
      author: profile.username || 'Cook',
      role,
      videoUri: publicUrl,
      posterUri: input.posterUri?.startsWith('https://') ? input.posterUri : '',
      durationSeconds: input.durationSeconds,
      createdAt: new Date().toISOString(),
      counts: { smile: 0, heart: 0, star: 0 },
      reactionsByUser: {},
    };
  });

export const publishClipLinkProcedure = protectedProcedure
  .input(z.object({
    mealName: z.string().min(1).max(80),
    videoUrl: z.string().min(12).max(500),
  }))
  .mutation(async ({ input, ctx }) => {
    const link = foodReviewLinkClip(input.videoUrl);
    if (!link) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Paste a YouTube, Facebook, TikTok, or Reddit link.' });
    }
    const { data: profile } = await ctx.supabaseAdmin
      .from('profiles')
      .select('username, role, membership_tier, trial_ends_at, stripe_subscription_id, apple_original_transaction_id, google_purchase_token')
      .eq('id', ctx.userId)
      .maybeSingle();
    const cookMayPost = profile?.role === 'platemaker' && platemakerMayEnter(profile);
    const buyerMayPost = profile?.role === 'platetaker' && profile.membership_tier === 'premium';
    if (!profile || (!cookMayPost && !buyerMayPost)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Posting a clip is for a premium membership.' });
    }
    const id = `clip-${Date.now()}`;
    const role = profile.role === 'platemaker' ? 'platemaker' : 'platetaker';
    const mealName = input.mealName.trim();
    const { error } = await ctx.supabaseAdmin.from('food_review_clips').insert({
      id,
      user_id: ctx.userId,
      meal_name: mealName,
      author: profile.username || 'Cook',
      role,
      video_url: link.videoUri,
      poster_url: link.posterUri.startsWith('https://') ? link.posterUri : null,
      duration_seconds: 20,
    });
    if (error) {
      if (missingTable(error)) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The shared clip timeline is not on this kitchen yet.' });
      }
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The clip could not be posted.' });
    }
    return {
      id,
      mealName,
      author: profile.username || 'Cook',
      role,
      videoUri: link.videoUri,
      posterUri: link.posterUri,
      durationSeconds: 20,
      durationMeasured: false as const,
      createdAt: new Date().toISOString(),
      counts: { smile: 0, heart: 0, star: 0 },
      reactionsByUser: {},
    };
  });
