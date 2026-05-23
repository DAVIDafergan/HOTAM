import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';
import { buildPublicImageUrl } from '@/lib/s3-upload';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
]);
const MAX_SIZE = 10 * 1024 * 1024;

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const uploadContext = req.headers.get('x-upload-context');
    const isOnboarding = uploadContext === 'onboarding';
    const { fileName, contentType, fileSize, keyPrefix = 'products' } = await req.json();

    if (!isOnboarding) {
      if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );
      const { data: { user }, error } = await serviceClient.auth.getUser(token);
      if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    } else {
      const ONBOARDING_MAX_PRESIGN = 2 * 1024 * 1024;
      if (fileSize && fileSize > ONBOARDING_MAX_PRESIGN) {
        return NextResponse.json({ error: 'Onboarding upload must be under 2MB' }, { status: 413 });
      }
    }

    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }
    if (!fileSize || fileSize > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const region = process.env.AWS_REGION?.trim();
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
    const bucket = process.env.AWS_S3_BUCKET?.trim();

    if (!region || !accessKeyId || !secretAccessKey || !bucket) {
      console.error('[presign] Missing AWS environment variables');
      return NextResponse.json({ error: 'Upload service is not configured' }, { status: 503 });
    }

    const s3 = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });

    const sanitized = (fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${keyPrefix}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${sanitized}`;

    const presignedUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      { expiresIn: 300 }
    );

    const publicUrl = buildPublicImageUrl(key);

    return NextResponse.json({ presignedUrl, publicUrl, key });
  } catch (err) {
    console.error('[presign] error:', err);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
