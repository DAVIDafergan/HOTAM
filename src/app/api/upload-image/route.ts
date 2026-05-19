import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToS3 } from '@/lib/s3-upload';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
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

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File is too large (max 5MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadImageToS3(buffer, file.name, file.type);

    return NextResponse.json({ url });
  } catch (error: unknown) {
    console.error('S3 upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
