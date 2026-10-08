import { protectedProcedure } from '../../../create-context';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { decode } from 'base64-arraybuffer';
import { scanImage, scanVideo } from '../../../../lib/image-security';

/**
 * Upload Meal Media Procedure
 *
 * Uploads an image or video for a meal to the `meal-media` Supabase Storage bucket.
 * Images are run through the full security scanner before any storage write:
 *   - Magic bytes MIME validation
 *   - File size check (≤ 10 MB)
 *   - Metadata prompt injection scan (EXIF/JPEG comments, PNG text chunks)
 *   - Trailing data / steganography detection
 *   - NSFW moderation via Cloudflare Workers AI (when binding is available)
 *
 * Video files are scanned for a real MP4 or QuickTime container, size, and
 * metadata injection before any storage write. A failed scan refuses the file.
 *
 * Storage path: {userId}/{mealId}/{timestamp}.{ext}
 * Also inserts a row into `media_attachments` for cleanup tracking.
 */
export const uploadMediaProcedure = protectedProcedure
  .input(
    z.object({
      mealId: z.string(),
      base64Data: z.string(),
      mimeType: z.string(),
      type: z.enum(['image', 'video']),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { data: meal, error: mealError } = await ctx.supabaseAdmin
      .from('meals')
      .select('id, user_id')
      .eq('id', input.mealId)
      .single();

    if (mealError || !meal || meal.user_id !== ctx.userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You can only upload media for your own meals',
      });
    }

    const arrayBuffer = decode(input.base64Data);

    if (input.type === 'video') {
      const scanResult = scanVideo(arrayBuffer, input.mimeType);
      if (!scanResult.allowed) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: scanResult.reason ?? 'Video failed security check',
        });
      }
    }

    if (input.type === 'image') {
      const scanResult = await scanImage(
        arrayBuffer,
        input.base64Data,
        'meal',
        input.mimeType,
        ctx.ai,
      );

      if (!scanResult.allowed) {
        await Promise.resolve(
          ctx.supabaseAdmin
            .from('audit_logs')
            .insert({
              action: 'MEAL_IMAGE_BLOCKED',
              user_id: ctx.userId,
              new_data: {
                reason: scanResult.reason,
                flags: scanResult.flags,
                mealId: input.mealId,
                declaredMimeType: input.mimeType,
                detectedMimeType: scanResult.detectedMime,
              },
            })
        ).catch(() => {});

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: scanResult.reason ?? 'Image failed security check',
        });
      }

      // Audit non-trivial flag sets (MIME mismatch, large-file skip, etc.)
      if (scanResult.flags.length > 0) {
        await Promise.resolve(
          ctx.supabaseAdmin
            .from('audit_logs')
            .insert({
              action: 'MEAL_IMAGE_SCANNED',
              user_id: ctx.userId,
              new_data: {
                flags: scanResult.flags,
                mealId: input.mealId,
                detectedMimeType: scanResult.detectedMime,
              },
            })
        ).catch(() => {});
      }
    }

    const fileExt = input.mimeType.split('/')[1];
    const fileName = `${ctx.userId}/${input.mealId}/${Date.now()}.${fileExt}`;
    const bucketName = 'meal-media';

    const { data: uploadData, error: uploadError } = await ctx.supabase.storage
      .from(bucketName)
      .upload(fileName, arrayBuffer, {
        contentType: input.mimeType,
        upsert: false,
      });

    if (uploadError || !uploadData) {
      console.error('[UploadMedia] Error:', uploadError);
      throw new Error(uploadError?.message || 'Failed to upload media');
    }

    const { data: publicUrlData } = ctx.supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    const { data: mealRow } = await ctx.supabase
      .from('meals')
      .select('images')
      .eq('id', input.mealId)
      .single();
    const currentImages = Array.isArray(mealRow?.images) ? mealRow.images : [];
    const { error: imageUpdateError } = await ctx.supabase
      .from('meals')
      .update({ images: [...currentImages, publicUrlData.publicUrl], published: true })
      .eq('id', input.mealId);
    if (imageUpdateError) {
      throw new Error(imageUpdateError.message || 'Failed to attach media to the plate');
    }

    const { data: attachment, error: attachmentError } = await ctx.supabase
      .from('media_attachments')
      .insert({
        meal_id: input.mealId,
        user_id: ctx.userId,
        uri: publicUrlData.publicUrl,
        type: input.type,
        storage_path: fileName,
      })
      .select()
      .single();

    if (attachmentError || !attachment) {
      console.error('[UploadMedia] Attachment error:', attachmentError);
      throw new Error('Failed to save media attachment');
    }

    return {
      id: attachment.id,
      uri: attachment.uri,
      type: attachment.type,
      createdAt: new Date(attachment.created_at),
    };
  });
