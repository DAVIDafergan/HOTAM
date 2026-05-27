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

    let metadata: Partial<ImageAssetRecord> = {
      source_key: key,
      source_url: publicUrl,
      original_s3_url: publicUrl,
      delivery_url: publicUrl,
      kind,
      upload_context: isOnboarding ? 'onboarding' : 'authenticated',
      owner_id: user?.id || null,
      migration_status: 'pending',
    };

    if (isCloudinaryServerConfigured()) {
      try {
        const cloudinaryAsset = await uploadRemoteImageToCloudinary({
          sourceUrl: publicUrl,
          sourceKey: key,
          kind,
          ownerId: user?.id || null,
          uploadContext: isOnboarding ? 'onboarding' : 'authenticated',
        });

        metadata = {
          ...metadata,
          ...cloudinaryAsset,
          delivery_url: cloudinaryAsset.cloudinary_secure_url || publicUrl,
        };
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === CLOUDINARY_CONFIG_ERROR)) {
          console.error('[upload-image-complete] Cloudinary sync failed', error);
        }
        metadata = {
          ...metadata,
          migration_status: 'failed',
        };
      }
    }

    const persisted = await persistImageAsset({
      ownerId: user?.id || null,
      sourceKey: key,
      sourceUrl: publicUrl,
      originalS3Url: publicUrl,
      deliveryUrl: metadata.delivery_url || publicUrl,
      cloudinarySecureUrl: metadata.cloudinary_secure_url || null,
      cloudinaryPublicId: metadata.cloudinary_public_id || null,
      blurDataUrl: metadata.blur_data_url || null,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      kind,
      uploadContext: isOnboarding ? 'onboarding' : 'authenticated',
      migrationStatus: (metadata.migration_status || 'pending') as 'pending' | 'migrated' | 'failed' | 'deleted',
    });

    return NextResponse.json({
      url: metadata.delivery_url || publicUrl,
      metadata: persisted || metadata,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[upload-image-complete] error', error);
    return NextResponse.json({ error: 'Failed to finalize upload' }, { status: 500 });
  }
}
