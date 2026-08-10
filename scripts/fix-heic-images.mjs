/**
 * Retroactively fixes already-uploaded HEIC/HEIF images that are stored raw (unreadable
 * by any browser) in `products.images`, `sellers.profile_image`, `sellers.certificate_url`,
 * and `sellers.writing_samples`.
 *
 * Unlike migrate-cloudinary-assets.mjs, this script updates the *source-of-truth* columns
 * themselves (not just the `image_assets` bookkeeping table), because the app renders images
 * directly from those columns and never reads `image_assets` back.
 *
 * Usage:
 *   node scripts/fix-heic-images.mjs            # dry run — lists what would change, no writes
 *   node scripts/fix-heic-images.mjs --apply     # converts via Cloudinary and updates the DB
 *
 * Required env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */
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

const APPLY = process.argv.includes('--apply');
const batchSize = Number.parseInt(process.env.HEIC_FIX_BATCH_SIZE || '25', 10);

cloudinary.config({
  cloud_name: cloudName,
  api_key: cloudinaryApiKey,
  api_secret: cloudinaryApiSecret,
  secure: true,
});

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const HEIC_EXTENSION_RE = /\.(heic|heif)(\?.*)?$/i;

function isHeicUrl(url) {
  return typeof url === 'string' && HEIC_EXTENSION_RE.test(url);
}

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

async function convertHeicUrl(sourceUrl, kind) {
  const upload = await cloudinary.uploader.upload(sourceUrl, {
    public_id: toPublicId(kind, sourceUrl),
    overwrite: true,
    resource_type: 'image',
    format: 'jpg',
    tags: ['hotam', 'heic-fix', `kind:${kind}`],
  });
  return upload;
}

async function recordAsset({ ownerId, sourceUrl, kind, uploadContext, upload }) {
  const { error } = await supabase.from('image_assets').upsert(
    {
      owner_id: ownerId || null,
      source_key: normalizeKey(sourceUrl) || null,
      source_url: sourceUrl,
      original_s3_url: sourceUrl,
      delivery_url: upload.secure_url,
      cloudinary_secure_url: upload.secure_url,
      cloudinary_public_id: upload.public_id,
      width: upload.width,
      height: upload.height,
      kind,
      upload_context: uploadContext,
      migration_status: 'migrated',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'source_url', ignoreDuplicates: false }
  );
  if (error) console.error('[fix-heic] image_assets upsert failed', error);
}

async function fixProducts() {
  let from = 0;
  let fixed = 0;

  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('id, seller_id, images')
      .range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const product of data) {
      const images = Array.isArray(product.images) ? product.images : [];
      const heicUrls = images.filter(isHeicUrl);
      if (heicUrls.length === 0) continue;

      const replacements = new Map();
      for (const sourceUrl of heicUrls) {
        console.info(`[fix-heic] product ${product.id}: ${sourceUrl}`);
        if (!APPLY) continue;
        try {
          const upload = await convertHeicUrl(sourceUrl, 'product');
          replacements.set(sourceUrl, upload.secure_url);
          await recordAsset({ ownerId: product.seller_id, sourceUrl, kind: 'product', uploadContext: 'authenticated', upload });
          fixed += 1;
        } catch (err) {
          console.error(`[fix-heic] FAILED product ${product.id} ${sourceUrl}`, err);
        }
      }

      if (APPLY && replacements.size > 0) {
        const newImages = images.map((url) => replacements.get(url) || url);
        const { error: updateError } = await supabase
          .from('products')
          .update({ images: newImages })
          .eq('id', product.id);
        if (updateError) console.error(`[fix-heic] failed to update product ${product.id}`, updateError);
      }
    }

    from += data.length;
    if (data.length < batchSize) break;
  }

  console.info(`[fix-heic] products done, ${fixed} image(s) ${APPLY ? 'fixed' : 'found (dry run)'}`);
}

async function fixSellers() {
  let from = 0;
  let fixed = 0;

  while (true) {
    const { data, error } = await supabase
      .from('sellers')
      .select('id, profile_image, certificate_url, writing_samples')
      .range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const seller of data) {
      const updates = {};

      if (isHeicUrl(seller.profile_image)) {
        console.info(`[fix-heic] seller ${seller.id} profile_image: ${seller.profile_image}`);
        if (APPLY) {
          try {
            const upload = await convertHeicUrl(seller.profile_image, 'avatar');
            await recordAsset({ ownerId: seller.id, sourceUrl: seller.profile_image, kind: 'avatar', uploadContext: 'authenticated', upload });
            updates.profile_image = upload.secure_url;
            fixed += 1;
          } catch (err) {
            console.error(`[fix-heic] FAILED seller ${seller.id} profile_image`, err);
          }
        }
      }

      if (isHeicUrl(seller.certificate_url)) {
        console.info(`[fix-heic] seller ${seller.id} certificate_url: ${seller.certificate_url}`);
        if (APPLY) {
          try {
            const upload = await convertHeicUrl(seller.certificate_url, 'certificate');
            await recordAsset({ ownerId: seller.id, sourceUrl: seller.certificate_url, kind: 'certificate', uploadContext: 'authenticated', upload });
            updates.certificate_url = upload.secure_url;
            fixed += 1;
          } catch (err) {
            console.error(`[fix-heic] FAILED seller ${seller.id} certificate_url`, err);
          }
        }
      }

      const writingSamples = Array.isArray(seller.writing_samples) ? seller.writing_samples : [];
      const heicSamples = writingSamples.filter(isHeicUrl);
      if (heicSamples.length > 0) {
        const replacements = new Map();
        for (const sourceUrl of heicSamples) {
          console.info(`[fix-heic] seller ${seller.id} writing_sample: ${sourceUrl}`);
          if (!APPLY) continue;
          try {
            const upload = await convertHeicUrl(sourceUrl, 'writing_sample');
            await recordAsset({ ownerId: seller.id, sourceUrl, kind: 'writing_sample', uploadContext: 'authenticated', upload });
            replacements.set(sourceUrl, upload.secure_url);
            fixed += 1;
          } catch (err) {
            console.error(`[fix-heic] FAILED seller ${seller.id} writing_sample ${sourceUrl}`, err);
          }
        }
        if (APPLY && replacements.size > 0) {
          updates.writing_samples = writingSamples.map((url) => replacements.get(url) || url);
        }
      }

      if (APPLY && Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase.from('sellers').update(updates).eq('id', seller.id);
        if (updateError) console.error(`[fix-heic] failed to update seller ${seller.id}`, updateError);
      }
    }

    from += data.length;
    if (data.length < batchSize) break;
  }

  console.info(`[fix-heic] sellers done, ${fixed} image(s) ${APPLY ? 'fixed' : 'found (dry run)'}`);
}

if (!APPLY) {
  console.info('[fix-heic] DRY RUN — pass --apply to actually convert & update the database.');
}

await fixProducts();
await fixSellers();

console.info('[fix-heic] complete');
