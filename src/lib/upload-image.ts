/**
 * Client-side utility for uploading images directly to S3 via presigned URLs.
 * Bypasses the Vercel 4.5 MB request body limit by uploading directly from the browser.
 */
import type { ImageAssetKind, ImageAssetRecord } from '@/lib/cloudinary-shared';

export type UploadedImageAsset = {
  url: string;
  metadata: Partial<ImageAssetRecord> | null;
};

// Every network step below gets its own hard timeout so a stalled connection or an
// unresponsive endpoint can never leave the calling promise pending forever — it always
// settles (resolves or rejects) within a bounded time, letting the UI's finally block reset.
const PRESIGN_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 60_000;

function putFileWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error('העלאת התמונה נכשלה.'));
    };
    xhr.onerror = () => reject(new Error('העלאת התמונה נכשלה. בדוק/י את החיבור לאינטרנט.'));
    xhr.ontimeout = () => reject(new Error('העלאת התמונה ארכה זמן רב מדי. נסה/י שוב.'));
    xhr.send(file);
  });
}

export async function uploadImageDirect(
  file: File,
  options: {
    authToken?: string;
    keyPrefix?: string;
    contentType?: string;
    assetKind?: ImageAssetKind;
    onProgress?: (percent: number) => void;
  } = {}
): Promise<UploadedImageAsset> {
  const { authToken, keyPrefix = 'products', contentType = file.type, assetKind, onProgress } = options;

  const presignTimeoutController = new AbortController();
  const presignTimeoutId = setTimeout(() => presignTimeoutController.abort(), PRESIGN_TIMEOUT_MS);

  let presignRes: Response;
  try {
    presignRes = await fetch('/api/upload-image/presign', {
      method: 'POST',
      signal: presignTimeoutController.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        'x-upload-context': keyPrefix === 'onboarding' ? 'onboarding' : 'authenticated',
      },
      body: JSON.stringify({
        fileName: file.name,
        contentType,
        fileSize: file.size,
        keyPrefix,
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('הבקשה ארכה זמן רב מדי. בדוק/י את החיבור לאינטרנט ונסה/י שוב.');
    }
    throw error;
  } finally {
    clearTimeout(presignTimeoutId);
  }

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error((err as { error?: string })?.error || 'Failed to get upload URL');
  }

  const { presignedUrl, publicUrl, key } = await presignRes.json();

  await putFileWithProgress(presignedUrl, file, contentType, onProgress);
  onProgress?.(100);

  // The file is already live at `publicUrl` — resolve now so the UI can render it immediately.
  // The Cloudinary migration/metadata persistence is a background nicety and must not block that.
  void fetch('/api/upload-image/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: 'Bearer ' + authToken } : {}),
      'x-upload-context': keyPrefix === 'onboarding' ? 'onboarding' : 'authenticated',
    },
    body: JSON.stringify({
      publicUrl,
      key,
      fileName: file.name,
      contentType,
      assetKind,
    }),
  }).catch(() => undefined);

  return { url: publicUrl, metadata: null };
}
