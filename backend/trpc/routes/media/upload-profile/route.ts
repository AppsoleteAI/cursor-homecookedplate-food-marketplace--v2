import { protectedProcedure } from '../../../create-context';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { decode } from 'base64-arraybuffer';
import { scanImage } from '../../../../lib/image-security';

/**
 * Upload Profile Image Procedure
 *
 * Uploads a profile photo to the `profile-images` Supabase Storage bucket.
 * The file goes through the image security scanner before any storage write:
 *   - Magic bytes MIME validation
 *   - File size check (≤ 5 MB)
 *   - Metadata prompt injection scan
 *   - Trailing data / steganography detection
 *   - NSFW moderation via Cloudflare Workers AI (when binding is available)
 *
 * Storage path: {userId}/{timestamp}.{ext}
 * Returns the public URL to be stored in profiles.profile_image via auth.updateProfile.
 */
export const uploadProfileImageProcedure = protectedProcedure
  .input(
    z.object({
      base64Data: z.string().min(1),
      mimeType: z.string().min(1),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const arrayBuffer = decode(input.base64Data);

    const scanResult = await scanImage(
      arrayBuffer,
      input.base64Data,
      'profile',
      input.mimeType,
      ctx.ai,
    );

    if (!scanResult.allowed) {
      // Audit-log every blocked upload for admin review
      await Promise.resolve(
        ctx.supabaseAdmin
          .from('audit_logs')
          .insert({
            action: 'PROFILE_IMAGE_BLOCKED',
            user_id: ctx.userId,
            new_data: {
              reason: scanResult.reason,
              flags: scanResult.flags,
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

    // Use the authoritative detected MIME type for the stored file extension
    const ext = (scanResult.detectedMime ?? input.mimeType).split('/')[1] ?? 'jpg';
    const fileName = `${ctx.userId}/${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadError } = await ctx.supabase.storage
      .from('profile-images')
      .upload(fileName, arrayBuffer, {
        contentType: scanResult.detectedMime ?? input.mimeType,
        upsert: true, // allow re-upload to same path (overwrite previous avatar)
      });

    if (uploadError || !uploadData) {
      console.error('[UploadProfileImage] Storage error:', uploadError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: uploadError?.message ?? 'Failed to upload profile image',
      });
    }

    const { data: urlData } = ctx.supabase.storage
      .from('profile-images')
      .getPublicUrl(fileName);

    // Log non-empty flag sets for admin visibility (even when allowed)
    if (scanResult.flags.length > 0) {
      await Promise.resolve(
        ctx.supabaseAdmin
          .from('audit_logs')
          .insert({
            action: 'PROFILE_IMAGE_UPLOADED',
            user_id: ctx.userId,
            new_data: {
              flags: scanResult.flags,
              storagePath: fileName,
              publicUrl: urlData.publicUrl,
            },
          })
      ).catch(() => {});
    }

    return { uri: urlData.publicUrl };
  });
