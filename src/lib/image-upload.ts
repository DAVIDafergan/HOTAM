import type { SupabaseClient } from '@supabase/supabase-js';

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
  if (file.type?.startsWith('image/')) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  return MIME_BY_EXT[ext] ?? null;
}

export async function uploadImageViaApi(
  file: File,
  options?: { client?: SupabaseClient; uploadContext?: 'onboarding' }
): Promise<string> {
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

  const response = await fetch('/api/upload-image', {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    let message = 'העלאת התמונה נכשלה.';
    try {
      const data = await response.json();
      if (typeof data?.error === 'string' && data.error) message = data.error;
    } catch {
      // ignore non-JSON responses and keep fallback message
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
}
