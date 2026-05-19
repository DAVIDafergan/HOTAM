import type { SupabaseClient } from '@supabase/supabase-js';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
]);
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 30_000;
const MAX_UPLOAD_RETRIES = 1;

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
  if (file.size > MAX_UPLOAD_SIZE_BYTES) throw new Error('הקובץ גדול מדי. ניתן להעלות עד 10MB.');
}

export async function uploadImageViaApi(
  file: File,
  options?: { client?: SupabaseClient; uploadContext?: 'onboarding' }
): Promise<string> {
  validateUploadFile(file);
  const contentType = getImageMimeType(file);
  if (!contentType) throw new Error('סוג קובץ לא נתמך.');

  const formData = new FormData();
  formData.append('file', file);

  const headers: HeadersInit = {};
  if (options?.uploadContext === 'onboarding') {
    headers['x-upload-context'] = 'onboarding';
  }

  if (options?.client) {
    const { data: { session } } = await options.client.auth.getSession();
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_UPLOAD_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

    try {
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = 'העלאת התמונה נכשלה.';
        try {
          const data = await response.json();
          if (typeof data?.error === 'string' && data.error) message = data.error;
        } catch {
          // ignore non-JSON responses and keep fallback message
        }

        const retriable = response.status >= 500 || response.status === 429;
        if (retriable && attempt < MAX_UPLOAD_RETRIES) {
          continue;
        }

        throw new Error(message);
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new Error('תשובת השרת אינה תקינה.');
      }

      if (!data || typeof data !== 'object' || typeof (data as { url?: unknown }).url !== 'string') {
        throw new Error('תשובת השרת אינה תקינה.');
      }

      return (data as { url: string }).url;
    } catch (error: unknown) {
      const isAbort = error instanceof DOMException && error.name === 'AbortError';
      if (isAbort) {
        lastError = new Error('העלאת הקובץ נמשכה יותר מדי זמן. נסה שוב.');
      } else {
        lastError = error instanceof Error ? error : new Error('העלאת התמונה נכשלה.');
      }

      if (attempt >= MAX_UPLOAD_RETRIES) {
        throw lastError;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error('העלאת התמונה נכשלה.');
}
