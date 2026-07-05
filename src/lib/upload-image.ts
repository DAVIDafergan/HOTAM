/**
 * Client-side utility for uploading images directly to S3 via presigned URLs.
 * Bypasses the Vercel 4.5 MB request body limit by uploading directly from the browser.
 */
import type { ImageAssetKind, ImageAssetRecord } from '@/lib/cloudinary-shared';

export type UploadedImageAsset = {
  url: string;
  metadata: Partial<ImageAssetRecord> | null;
};

function putFileWithProgress(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
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
    xhr.onerror = () => reject(new Error('העלאת התמונה נכשלה.'));
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

  const presignRes = await fetch('/api/upload-image/presign', {
    method: 'POST',
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

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error((err as { error?: string })?.error || 'Failed to get upload URL');
  }

  const { presignedUrl, publicUrl, key } = await presignRes.json();

  await putFileWithProgress(presignedUrl, file, contentType, onProgress);
  onProgress?.(100);

  try {
    const completeRes = await fetch('/api/upload-image/complete', {
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
    });

    if (!completeRes.ok) {
      return { url: publicUrl, metadata: null };
    }

    const result = await completeRes.json();
    return {
      url: result?.url || publicUrl,
      metadata: result?.metadata || null,
    };
  } catch {
    return { url: publicUrl, metadata: null };
  }
}
