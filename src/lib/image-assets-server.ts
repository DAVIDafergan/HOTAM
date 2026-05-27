import { createClient } from '@supabase/supabase-js';
import type { ImageAssetKind, ImageAssetRecord, ImageMigrationStatus } from '@/lib/cloudinary-shared';

const IMAGE_ASSETS_TABLE = 'image_assets';

type PersistImageAssetInput = {
  ownerId?: string | null;
  sourceKey?: string | null;
  sourceUrl: string;
  originalS3Url: string;
  deliveryUrl: string;
  cloudinarySecureUrl?: string | null;
  cloudinaryPublicId?: string | null;
  blurDataUrl?: string | null;
  width?: number | null;
  height?: number | null;
  kind: ImageAssetKind;
  uploadContext: 'authenticated' | 'onboarding';
  migrationStatus: ImageMigrationStatus;
};

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeRow(input: PersistImageAssetInput) {
  const now = new Date().toISOString();

  return {
    owner_id: input.ownerId || null,
    source_key: input.sourceKey || null,
    source_url: input.sourceUrl,
    original_s3_url: input.originalS3Url,
    delivery_url: input.deliveryUrl,
    cloudinary_secure_url: input.cloudinarySecureUrl || null,
    cloudinary_public_id: input.cloudinaryPublicId || null,
    blur_data_url: input.blurDataUrl || null,
    width: input.width ?? null,
    height: input.height ?? null,
    kind: input.kind,
    upload_context: input.uploadContext,
    migration_status: input.migrationStatus,
    updated_at: now,
    created_at: now,
  };
}

function isMissingTableError(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string' &&
      (error as { message: string }).message.toLowerCase().includes(IMAGE_ASSETS_TABLE)
  );
}

export async function persistImageAsset(input: PersistImageAssetInput): Promise<ImageAssetRecord | null> {
  const client = getServiceClient();
  if (!client) return null;

  const payload = normalizeRow(input);
  const { data, error } = await client
    .from(IMAGE_ASSETS_TABLE)
    .upsert(payload, {
      onConflict: 'source_url',
      ignoreDuplicates: false,
    })
    .select('*')
    .single();

  if (error) {
    if (!isMissingTableError(error)) {
      console.error('[image-assets] persist failed', error);
    }
    return null;
  }

  return data as ImageAssetRecord;
}

export async function findImageAssetsByUrls(urls: string[]) {
  const client = getServiceClient();
  if (!client || urls.length === 0) return [] as ImageAssetRecord[];

  const columns = ['source_url', 'delivery_url', 'cloudinary_secure_url', 'original_s3_url'] as const;
  const results = await Promise.all(
    columns.map(async (column) => {
      const { data, error } = await client.from(IMAGE_ASSETS_TABLE).select('*').in(column, urls);
      if (error) {
        if (!isMissingTableError(error)) {
          console.error('[image-assets] lookup failed', error);
        }
        return [] as ImageAssetRecord[];
      }
      return (data || []) as ImageAssetRecord[];
    })
  );

  const unique = new Map<string, ImageAssetRecord>();
  for (const rows of results) {
    for (const row of rows) {
      unique.set(
        row.id ||
          row.delivery_url ||
          row.cloudinary_secure_url ||
          row.source_url ||
          row.original_s3_url ||
          Math.random().toString(36),
        row
      );
    }
  }

  return [...unique.values()];
}

export async function markImageAssetsDeleted(ids: string[]) {
  const client = getServiceClient();
  if (!client || ids.length === 0) return;

  const { error } = await client
    .from(IMAGE_ASSETS_TABLE)
    .update({ migration_status: 'deleted', updated_at: new Date().toISOString() })
    .in('id', ids);

  if (error && !isMissingTableError(error)) {
    console.error('[image-assets] delete mark failed', error);
  }
}
