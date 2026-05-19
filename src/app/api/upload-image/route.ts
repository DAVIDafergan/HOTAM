import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToS3 } from '@/lib/s3-upload';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
]);
export const maxDuration = 30;
export const runtime = 'nodejs';
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

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

function resolveImageType(file: File): string | null {
  if (ALLOWED_IMAGE_TYPES.has(file.type)) return file.type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext) return null;
  const inferredType = MIME_BY_EXT[ext];
  return inferredType && ALLOWED_IMAGE_TYPES.has(inferredType) ? inferredType : null;
}

export async function POST(req: NextRequest) {
  try {
    const contentLengthHeader = req.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_SIZE_BYTES) {
        return NextResponse.json({ error: 'הקובץ גדול מדי (עד 10MB).' }, { status: 413 });
      }
    }

    const uploadContext = req.headers.get('x-upload-context');
    const isOnboardingUpload = uploadContext === 'onboarding';

    if (!isOnboardingUpload) {
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace('Bearer ', '');
      if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { createClient } = await import('@supabase/supabase-js');
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );
      const { data: { user: authUser }, error: authError } = await serviceClient.auth.getUser(token);
      if (authError || !authUser) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name?.trim()) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'Empty file is not allowed' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: 'הקובץ גדול מדי (עד 10MB).' }, { status: 413 });
    }

    const contentType = resolveImageType(file);
    if (!contentType) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const keyPrefix = isOnboardingUpload ? 'onboarding' : 'products';
    const url = await uploadImageToS3(buffer, file.name, contentType, keyPrefix);

    return NextResponse.json({ url });
  } catch (error: unknown) {
    const errorCode = typeof error === 'object' && error && 'code' in error ? (error as { code?: unknown }).code : undefined;
    if (errorCode === 'S3_CONFIG_ERROR') {
      console.error('S3 upload configuration error');
      return NextResponse.json({ error: 'Upload service is not configured' }, { status: 503 });
    }
    console.error('S3 upload failed');
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
