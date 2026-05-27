import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

if (!cloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
  throw new Error('Missing Cloudinary environment variables');
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: cloudinaryApiKey,
  api_secret: cloudinaryApiSecret,
  secure: true,
});

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const batchSize = Number.parseInt(process.env.CLOUDINARY_MIGRATION_BATCH_SIZE || '25', 10);
const dryRun = process.env.CLOUDINARY_MIGRATION_DRY_RUN === 'true';

function normalizeKey(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ''));
  } catch {
    return '';
  }
}

function toPublicId(kind, url) {
  const sourceKey = normalizeKey(url).replace(/\.[a-z0-9]+$/i, '') || `legacy/${Date.now()}`;
  return `hotam/${kind}/${sourceKey.replace(/[^a-zA-Z0-9/_-]/g, '_')}`;
}

function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.includes('res.cloudinary.com');
}

async function migrateAsset({ ownerId, sourceUrl, kind, uploadContext }) {
  const payload = {
    owner_id: ownerId || null,
    source_key: normalizeKey(sourceUrl) || null,
    source_url: sourceUrl,
    delivery_url: sourceUrl,
    original_s3_url: sourceUrl,
    cloudinary_secure_url: null,
    cloudinary_public_id: null,
    kind,
    upload_context: uploadContext,
    migration_status: 'pending',
    updated_at: new Date().toISOString(),
  };

  if (!dryRun) {
    const upload = await cloudinary.uploader.upload(sourceUrl, {
      public_id: toPublicId(kind, sourceUrl),
      overwrite: true,
      resource_type: 'image',
      tags: ['hotam', 'migration', `kind:${kind}`],
    });

    payload.delivery_url = upload.secure_url;
    payload.cloudinary_secure_url = upload.secure_url;
    payload.cloudinary_public_id = upload.public_id;
    payload.width = upload.width;
    payload.height = upload.height;
    payload.migration_status = 'migrated';
  }

  const { error } = await supabase.from('image_assets').upsert(payload, {
    onConflict: 'source_url',
    ignoreDuplicates: false,
  });

  if (error) {
    throw error;
  }
}

async function processBatch(records, mapRecord) {
  for (const record of records) {
    const assets = mapRecord(record).filter((asset) => asset.sourceUrl && !isCloudinaryUrl(asset.sourceUrl));
    for (const asset of assets) {
      try {
        await migrateAsset(asset);
        console.info(`[cloudinary-migrate] migrated ${asset.kind}: ${asset.sourceUrl}`);
      } catch (error) {
        console.error(`[cloudinary-migrate] failed ${asset.kind}: ${asset.sourceUrl}`, error);
      }
    }
  }
}

async function paginate(table, select, mapRecord) {
  let from = 0;

  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    await processBatch(data, mapRecord);
    from += data.length;

    if (data.length < batchSize) break;
  }
}

await paginate(
  'products',
  'id, seller_id, images',
  (record) => (Array.isArray(record.images) ? record.images : []).map((sourceUrl) => ({
    ownerId: record.seller_id,
    sourceUrl,
    kind: 'product',
    uploadContext: 'authenticated',
  }))
);

await paginate(
  'sellers',
  'id, profile_image, certificate_url, writing_samples',
  (record) => [
    record.profile_image
      ? {
          ownerId: record.id,
          sourceUrl: record.profile_image,
          kind: 'avatar',
          uploadContext: 'authenticated',
        }
      : null,
    record.certificate_url
      ? {
          ownerId: record.id,
          sourceUrl: record.certificate_url,
          kind: 'certificate',
          uploadContext: 'authenticated',
        }
      : null,
    ...(Array.isArray(record.writing_samples)
      ? record.writing_samples.map((sourceUrl) => ({
          ownerId: record.id,
          sourceUrl,
          kind: 'writing_sample',
          uploadContext: 'authenticated',
        }))
      : []),
  ].filter(Boolean)
);

console.info('[cloudinary-migrate] complete');
