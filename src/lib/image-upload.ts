import type { SupabaseClient } from '@supabase/supabase-js';
import { uploadImageDirect } from '@/lib/upload-image';
import { compressImageFile } from '@/lib/image-compression';
import { isCloudinaryConfigured, type ImageAssetKind } from '@/lib/cloudinary-shared';

const HEIC_TYPES = new Set(['image/heic', 'image/heif']);
const PDF_TYPE = 'application/pdf';

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
  pdf: 'application/pdf',
};

// PDF is only ever accepted for the certificate slot — scribe certificates are commonly
// issued as scans/exports, unlike writing samples, which must be photos of live handwriting.
function getUploadMimeType(file: File, allowPdf: boolean): string | null {
  const allowedSet = allowPdf ? new Set([...ALLOWED_IMAGE_TYPES, PDF_TYPE]) : ALLOWED_IMAGE_TYPES;
  if (file.type && allowedSet.has(file.type)) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  const inferredType = MIME_BY_EXT[ext];
  return inferredType && allowedSet.has(inferredType) ? inferredType : null;
}

// No browser can decode raw HEIC/HEIF bytes in an <img>/<canvas> — used to skip the doomed
// local blob-URL preview attempt while the real file is still uploading/converting server-side.
export function isHeicFile(file: File): boolean {
  if (HEIC_TYPES.has(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext === 'heic' || ext === 'heif';
}

function validateUploadFile(file: File): void {
  if (!(file instanceof File)) throw new Error('קובץ לא תקין.');
  if (!file.name?.trim()) throw new Error('שם קובץ לא תקין.');
  if (file.size <= 0) throw new Error('לא ניתן להעלות קובץ ריק.');
  if (file.size > MAX_UPLOAD_SIZE_BYTES) throw new Error('הקובץ גדול מדי. ניתן להעלות עד 15MB.');
}

export async function uploadImageViaApi(
  file: File,
  options?: {
    client?: SupabaseClient;
    uploadContext?: 'onboarding';
    assetKind?: ImageAssetKind;
    onProgress?: (percent: number) => void;
  }
): Promise<string> {
  const result = await uploadImageAssetViaApi(file, options);
  return result.url;
}

export async function uploadImageAssetViaApi(
  file: File,
  options?: {
    client?: SupabaseClient;
    uploadContext?: 'onboarding';
    assetKind?: ImageAssetKind;
    onProgress?: (percent: number) => void;
  }
) {
  const allowPdf = options?.assetKind === 'certificate';

  validateUploadFile(file);
  const originalContentType = getUploadMimeType(file, allowPdf);
  if (!originalContentType) {
    throw new Error(
      allowPdf
        ? 'סוג הקובץ אינו נתמך. ניתן להעלות תמונה (JPG, PNG, WEBP, GIF, AVIF, HEIC) או קובץ PDF, עד 15MB.'
        : 'סוג הקובץ אינו נתמך. ניתן להעלות תמונות בפורמט JPG, PNG, WEBP, GIF, AVIF או HEIC (עד 15MB).'
    );
  }

  // HEIC/HEIF (the default iPhone photo format) can't be rendered by any browser and
  // must be converted server-side via Cloudinary — without it configured we'd upload
  // bytes that will never display, so block early with a clear, actionable message.
  if (HEIC_TYPES.has(originalContentType) && !isCloudinaryConfigured()) {
    throw new Error('תמונות בפורמט HEIC/HEIF (ברירת המחדל באייפון) אינן נתמכות כרגע. נא לשנות את פורמט התמונה ל-JPG או PNG ולנסות שוב.');
  }

  // Compress on the client before it ever leaves the device — cuts upload time and storage costs.
  // compressImageFile already no-ops for non-image types, so a PDF passes through untouched.
  const uploadFile = await compressImageFile(file);
  const contentType = getUploadMimeType(uploadFile, allowPdf) || originalContentType;

  let authToken: string | undefined;
  if (options?.client) {
    const { data: { session } } = await options.client.auth.getSession();
    if (session?.access_token) {
      authToken = session.access_token;
    }
  }

  const keyPrefix = options?.uploadContext === 'onboarding' ? 'onboarding' : 'products';

  return uploadImageDirect(uploadFile, {
    authToken,
    keyPrefix,
    contentType,
    assetKind: options?.assetKind,
    onProgress: options?.onProgress,
  });
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
