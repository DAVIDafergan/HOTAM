import type { SupabaseClient } from '@supabase/supabase-js';
import { uploadImageDirect } from '@/lib/upload-image';
import type { ImageAssetKind } from '@/lib/cloudinary-shared';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
]);
const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
};

function getImageMimeType(file: File): string | null {
  if (file.type && ALLOWED_IMAGE_TYPES.has(file.type)) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  const inferredType = MIME_BY_EXT[ext];
  return inferredType && ALLOWED_IMAGE_TYPES.has(inferredType) ? inferredType : null;
}

function validateUploadFile(file: File): void {
  if (!(file instanceof File)) throw new Error('קובץ לא תקין.');
  if (!file.name?.trim()) throw new Error('שם קובץ לא תקין.');
  if (file.size <= 0) throw new Error('לא ניתן להעלות קובץ ריק.');
  if (file.size > MAX_UPLOAD_SIZE_BYTES) throw new Error('הקובץ גדול מדי. ניתן להעלות עד 15MB.');
}

export async function uploadImageViaApi(
  file: File,
  options?: { client?: SupabaseClient; uploadContext?: 'onboarding'; assetKind?: ImageAssetKind }
): Promise<string> {
  const result = await uploadImageAssetViaApi(file, options);
  return result.url;
}

export async function uploadImageAssetViaApi(
  file: File,
  options?: { client?: SupabaseClient; uploadContext?: 'onboarding'; assetKind?: ImageAssetKind }
) {
  validateUploadFile(file);
  const contentType = getImageMimeType(file);
  if (!contentType) throw new Error('סוג קובץ לא נתמך.');

  let authToken: string | undefined;
  if (options?.client) {
    const { data: { session } } = await options.client.auth.getSession();
    if (session?.access_token) {
      authToken = session.access_token;
    }
  }

  const keyPrefix = options?.uploadContext === 'onboarding' ? 'onboarding' : 'products';

  return uploadImageDirect(file, { authToken, keyPrefix, contentType, assetKind: options?.assetKind });
}

export async function cleanupImageAssetsViaApi(
  urls: string[],
  options?: { client?: SupabaseClient; uploadContext?: 'onboarding' }
) {
  const filteredUrls = [...new Set(urls.filter(Boolean))];
  if (filteredUrls.length === 0) return;

  let authToken: string | undefined;
  if (options?.client) {
    const { data: { session } } = await options.client.auth.getSession();
    if (session?.access_token) {
      authToken = session.access_token;
    }
  }

  await fetch('/api/image-assets', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: 'Bearer ' + authToken } : {}),
      'x-upload-context': options?.uploadContext === 'onboarding' ? 'onboarding' : 'authenticated',
    },
    body: JSON.stringify({ urls: filteredUrls }),
  }).catch(() => undefined);
}
