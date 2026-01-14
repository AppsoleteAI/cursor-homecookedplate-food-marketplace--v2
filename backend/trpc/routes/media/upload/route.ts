import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { decode } from 'base64-arraybuffer';

export const uploadMediaProcedure = protectedProcedure
  .input(
    z.object({
      mealId: z.string(),
      base64Data: z.string(),
      mimeType: z.string(),
      type: z.enum(['image', 'video']),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const fileExt = input.mimeType.split('/')[1];
    const fileName = `${ctx.userId}/${input.mealId}/${Date.now()}.${fileExt}`;
    const bucketName = 'meal-media';

    const arrayBuffer = decode(input.base64Data);

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
