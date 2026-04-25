/**
 * storageUpload.js
 *
 * Reusable Supabase Storage upload helper.
 *
 * Key behaviour:
 *   - If an existing path is provided, it is DELETED before uploading the new file.
 *   - Returns the new storage path (not a URL) on success, null on failure.
 *
 * Usage:
 *   import { uploadImage } from '../helpers/storageUpload';
 *
 *   // Upload new (no previous image)
 *   const path = await uploadImage({
 *     bucket: 'chat-images',
 *     path: `${schoolId}/chat-covers/${chatId}.jpg`,
 *     uri: pickedImageUri,
 *     mimeType: 'image/jpeg',
 *   });
 *
 *   // Replace existing image
 *   const path = await uploadImage({
 *     bucket: 'avatars',
 *     path: `${schoolId}/profiles/${profileId}.jpg`,
 *     uri: pickedImageUri,
 *     mimeType: 'image/jpeg',
 *     previousPath: profile.avatar_url,   // deleted before upload
 *   });
 *
 *   // Delete only (no upload)
 *   await deleteStorageFile('avatars', oldPath);
 */

import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';

/**
 * deleteStorageFile(bucket, path)
 * Silently deletes a file from Supabase Storage.
 * Never throws — errors are logged but swallowed so callers don't need try/catch.
 */
export async function deleteStorageFile(bucket, path) {
  if (!bucket || !path) return;
  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch (e) {
    console.warn(`[storageUpload] delete failed — ${bucket}/${path}:`, e?.message);
  }
}

/**
 * uploadImage({ bucket, path, uri, mimeType, previousPath })
 *
 * @param {object} opts
 * @param {string} opts.bucket       — Supabase Storage bucket name
 * @param {string} opts.path         — Destination path inside the bucket
 * @param {string} opts.uri          — Local file URI (from ImagePicker / DocumentPicker)
 * @param {string} [opts.mimeType]   — MIME type (default: 'image/jpeg')
 * @param {string} [opts.previousPath] — Existing path to delete before uploading
 *
 * @returns {Promise<string|null>}   — The new path on success, null on failure
 */
export async function uploadImage({ bucket, path, uri, mimeType = 'image/jpeg', previousPath }) {
  try {
    // 1. Delete previous file if provided
    if (previousPath && previousPath !== path) {
      await deleteStorageFile(bucket, previousPath);
    }

    // 2. Read local file as base64
    const base64   = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    const arrayBuf = decodeBase64(base64);

    // 3. Upload — upsert:true handles the race where path already exists
    const { error } = await supabase.storage.from(bucket).upload(path, arrayBuf, {
      contentType: mimeType,
      upsert: true,
    });

    if (error) {
      console.warn(`[storageUpload] upload failed — ${bucket}/${path}:`, error.message);
      return null;
    }

    return path;
  } catch (e) {
    console.warn('[storageUpload] unexpected error:', e?.message);
    return null;
  }
}
