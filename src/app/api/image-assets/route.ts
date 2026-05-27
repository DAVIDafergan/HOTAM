import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteCloudinaryImage } from '@/lib/cloudinary-server';
import { findImageAssetsByUrls, markImageAssetsDeleted } from '@/lib/image-assets-server';

export const runtime = 'nodejs';

async function getAuthenticatedUser(token?: string | null) {
  if (!token) return null;

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function DELETE(req: NextRequest) {
  try {
    const uploadContext = req.headers.get('x-upload-context');
    const isOnboarding = uploadContext === 'onboarding';
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const authUser = await getAuthenticatedUser(token);
    const body = await req.json().catch(() => null);
    const urls = Array.isArray(body?.urls)
      ? [...new Set(body.urls.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0))]
      : [];

    if (urls.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    if (!authUser && !isOnboarding) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assets = await findImageAssetsByUrls(urls);
    const removableAssets = assets.filter((asset) => {
      if (authUser?.id) {
        return asset.owner_id === authUser.id;
      }

      return (
        isOnboarding &&
        asset.upload_context === 'onboarding' &&
        typeof asset.source_key === 'string' &&
        asset.source_key.startsWith('onboarding/')
      );
    });

    await Promise.all(
      removableAssets.map(async (asset) => {
        if (!asset.cloudinary_public_id) return;
        try {
          await deleteCloudinaryImage(asset.cloudinary_public_id);
        } catch (error) {
          console.error('[image-assets] Cloudinary delete failed', error);
        }
      })
    );

    await markImageAssetsDeleted(removableAssets.map((asset) => asset.id!).filter(Boolean));

    return NextResponse.json({ deleted: removableAssets.length });
  } catch (error) {
    console.error('[image-assets] delete failed', error);
    return NextResponse.json({ error: 'Failed to delete image assets' }, { status: 500 });
  }
}
