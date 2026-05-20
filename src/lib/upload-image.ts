/**
 * Client-side utility for uploading images directly to S3 via presigned URLs.
 * Bypasses the Vercel 4.5 MB request body limit by uploading directly from the browser.
 */
export async function uploadImageDirect(
  file: File,
  options: { authToken?: string; keyPrefix?: string; contentType?: string } = {}
): Promise<string> {
  const { authToken, keyPrefix = 'products', contentType = file.type } = options;

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

  const { presignedUrl, publicUrl } = await presignRes.json();

  const uploadRes = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });

  if (!uploadRes.ok) throw new Error('העלאת התמונה נכשלה.');

  return publicUrl;
}
