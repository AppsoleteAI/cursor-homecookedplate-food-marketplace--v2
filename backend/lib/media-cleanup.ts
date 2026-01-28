import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Media Cleanup Processing Utility
 * 
 * Processes pending media cleanup requests logged by the SQL trigger `log_media_cleanup`.
 * When a meal is deleted, the trigger logs DELETE_MEDIA_PENDING to audit_logs with
 * image paths in old_data.images. This function:
 * 1. Fetches pending cleanup logs
 * 2. Deletes files from Supabase Storage (meal-media bucket)
 * 3. Marks logs as completed
 * 
 * Corresponds to SQL Section 6 in security_enhancements.sql
 * 
 * @param supabase - Supabase client (should use service role for admin operations)
 * @param batchSize - Number of logs to process per batch (default: 10)
 * @returns Statistics about the cleanup operation
 */
export interface MediaCleanupResult {
  processed: number;
  failed: number;
  skipped: number;
  errors: Array<{ logId: string; error: string }>;
}

export async function processMediaCleanup(
  supabase: SupabaseClient,
  batchSize: number = 10
): Promise<MediaCleanupResult> {
  const result: MediaCleanupResult = {
    processed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  // 1. Fetch pending cleanups
  const { data: logs, error: logError } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('action', 'DELETE_MEDIA_PENDING')
    .order('created_at', { ascending: true }) // Process oldest first
    .limit(batchSize);

  if (logError) {
    console.error('[MediaCleanup] Failed to fetch pending cleanups:', logError);
    result.errors.push({ logId: 'fetch', error: logError.message });
    return result;
  }

  if (!logs || logs.length === 0) {
    return result; // No pending cleanups
  }

  // 2. Process each log
  for (const log of logs) {
    const mealId = log.record_id;
    const images = log.old_data?.images as string[] | undefined;

    // Skip if no images to clean up
    if (!images || images.length === 0) {
      console.warn(`[MediaCleanup] Log ${log.id} has no images to clean up`);
      result.skipped++;
      
      // Still mark as completed since there's nothing to clean
      const { error: updateError } = await supabase
        .from('audit_logs')
        .update({ action: 'DELETE_MEDIA_COMPLETED' })
        .eq('id', log.id);

      if (updateError) {
        console.error(`[MediaCleanup] Failed to mark log ${log.id} as completed:`, updateError);
        result.failed++;
        result.errors.push({ logId: log.id, error: `Update failed: ${updateError.message}` });
      } else {
        result.processed++;
      }
      continue;
    }

    // 3. Extract storage paths from images array
    // Images may be stored as:
    // - Full URLs: "https://...supabase.co/storage/v1/object/public/meal-media/userId/mealId/file.jpg"
    // - Storage paths: "userId/mealId/file.jpg"
    // - Just filenames: "file.jpg"
    const storagePaths: string[] = [];

    for (const image of images) {
      if (!image || typeof image !== 'string') {
        continue;
      }

      let path = image;

      // If it's a full URL, extract the path after the bucket name
      if (image.includes('meal-media/')) {
        const parts = image.split('meal-media/');
        path = parts[parts.length - 1];
      } else if (image.includes('storage/v1/object/public/meal-media/')) {
        const parts = image.split('storage/v1/object/public/meal-media/');
        path = parts[parts.length - 1];
      } else if (image.startsWith('http')) {
        // If it's a URL but doesn't match expected patterns, try to extract path
        // This handles edge cases where URL format might differ
        const urlMatch = image.match(/meal-media\/(.+)$/);
        if (urlMatch) {
          path = urlMatch[1];
        } else {
          console.warn(`[MediaCleanup] Could not extract path from URL: ${image}`);
          continue; // Skip this image
        }
      }

      // Clean up the path (remove query params, fragments, etc.)
      path = path.split('?')[0].split('#')[0];

      if (path && path.length > 0) {
        storagePaths.push(path);
      }
    }

    // 4. Also check media_attachments table for additional storage paths
    // This ensures we catch all files even if they weren't in the images array
    if (mealId) {
      const { data: attachments } = await supabase
        .from('media_attachments')
        .select('storage_path')
        .eq('meal_id', mealId);

      if (attachments) {
        for (const attachment of attachments) {
          if (attachment.storage_path && !storagePaths.includes(attachment.storage_path)) {
            storagePaths.push(attachment.storage_path);
          }
        }
      }
    }

    // 5. Remove files from Supabase Storage
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('meal-media') // Correct bucket name
        .remove(storagePaths);

      if (storageError) {
        console.error(`[MediaCleanup] Failed to delete storage for log ${log.id}:`, storageError);
        result.failed++;
        result.errors.push({
          logId: log.id,
          error: `Storage deletion failed: ${storageError.message}`,
        });
        
        // Don't mark as completed if storage deletion failed
        // This allows retry on next run
        continue;
      }

      console.log(`[MediaCleanup] Successfully deleted ${storagePaths.length} files for log ${log.id}`);
    }

    // 6. Mark log as completed
    const { error: updateError } = await supabase
      .from('audit_logs')
      .update({ action: 'DELETE_MEDIA_COMPLETED' })
      .eq('id', log.id);

    if (updateError) {
      console.error(`[MediaCleanup] Failed to mark log ${log.id} as completed:`, updateError);
      result.failed++;
      result.errors.push({
        logId: log.id,
        error: `Update failed: ${updateError.message}`,
      });
    } else {
      result.processed++;
    }
  }

  return result;
}
