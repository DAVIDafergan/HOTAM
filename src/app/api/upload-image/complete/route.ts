import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CLOUDINARY_CONFIG_ERROR, isCloudinaryServerConfigured, uploadRemoteImageToCloudinary } from '@/lib/cloudinary-server';
import { inferImageKind, type ImageAssetKind, type ImageAssetRecord } from '@/lib/cloudinary-shared';
import { persistImageAsset } from '@/lib/image-assets-server';
import { buildPublicImageUrl } from '@/lib/s3-upload';

export const runtime = 'nodejs';

async function authenticateRequest(req: NextRequest, requireAuth: boolean) {
  if (!requireAuth) return null;

  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) {
    throw new Error('UNAUTHORIZED');
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) {
    throw new Error('UNAUTHORIZED');
  }

  return user;
}

export async function POST(req: NextRequest) {
  try {
    const uploadContext = req.headers.get('x-upload-context');
    const isOnboarding = uploadContext === 'onboarding';
    const user = await authenticateRequest(req, !isOnboarding);
    const body = await req.json();
    const publicUrl = typeof body?.publicUrl === 'string' ? body.publicUrl.trim() : '';
    const key = typeof body?.key === 'string' ? body.key.trim() : '';
    const assetKind = body?.assetKind as ImageAssetKind | undefined;

    if (!publicUrl || !key) {
      return NextResponse.json({ error: 'Missing upload payload' }, { status: 400 });
    }

    if (buildPublicImageUrl(key) !== publicUrl) {
      return NextResponse.json({ error: 'Invalid upload reference' }, { status: 400 });
    }

    const kind = inferImageKind(assetKind, key.split('/')[0], isOnboarding ? 'certificate' : 'product');
    const uploadContextValue = isOnboarding ? 'onboarding' : 'authenticated';
    const ownerId = user?.id || null;

    const pendingMetadata: Partial<ImageAssetRecord> = {
      source_key: key,
      source_url: publicUrl,
      original_s3_url: publicUrl,
      delivery_url: publicUrl,
      kind,
      upload_context: uploadContextValue,
      owner_id: ownerId,
      migration_status: 'pending',
    };

    const persisted = await persistImageAsset({
      ownerId,
      sourceKey: key,
      sourceUrl: publicUrl,
      originalS3Url: publicUrl,
      deliveryUrl: publicUrl,
      cloudinarySecureUrl: null,
      cloudinaryPublicId: null,
      blurDataUrl: null,
      width: null,
      height: null,
      kind,
      uploadContext: uploadContextValue,
      migrationStatus: 'pending',
    });

    const response = NextResponse.json({
      url: publicUrl,
      metadata: persisted || pendingMetadata,
    });

    if (isCloudinaryServerConfigured()) {
      void (async () => {
        try {
          const cloudinaryAsset = await uploadRemoteImageToCloudinary({
            sourceUrl: publicUrl,
            sourceKey: key,
            kind,
            ownerId,
            uploadContext: uploadContextValue,
          });

          await persistImageAsset({
            ownerId,
            sourceKey: key,
            sourceUrl: publicUrl,
            originalS3Url: publicUrl,
            deliveryUrl: cloudinaryAsset.cloudinary_secure_url || publicUrl,
            cloudinarySecureUrl: cloudinaryAsset.cloudinary_secure_url || null,
            cloudinaryPublicId: cloudinaryAsset.cloudinary_public_id || null,
            blurDataUrl: cloudinaryAsset.blur_data_url || null,
            width: cloudinaryAsset.width ?? null,
            height: cloudinaryAsset.height ?? null,
            kind,
            uploadContext: uploadContextValue,
            migrationStatus: 'migrated',
          });
        } catch (error) {
          if (!(error instanceof Error && 'code' in error && error.code === CLOUDINARY_CONFIG_ERROR)) {
            console.error('[upload-image-complete] Cloudinary async failed', error);
          }

          await persistImageAsset({
            ownerId,
            sourceKey: key,
            sourceUrl: publicUrl,
            originalS3Url: publicUrl,
            deliveryUrl: publicUrl,
            cloudinarySecureUrl: null,
            cloudinaryPublicId: null,
            blurDataUrl: null,
            width: null,
            height: null,
            kind,
            uploadContext: uploadContextValue,
            migrationStatus: 'failed',
          });
        }
      })();
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[upload-image-complete] error', error);
    return NextResponse.json({ error: 'Failed to finalize upload' }, { status: 500 });
  }
}
