import { v2 as cloudinary } from 'cloudinary';
import {
  type ImageAssetKind,
  type ImageAssetRecord,
  buildCloudinaryImageUrl,
  getCloudinaryCloudName,
  getImageBlurDataUrl,
} from '@/lib/cloudinary-shared';

const CLOUDINARY_CONFIG_ERROR = 'CLOUDINARY_CONFIG_ERROR';
let isConfigured = false;

function createConfigError(message: string) {
  const error = new Error(message) as Error & { code: string };
  error.code = CLOUDINARY_CONFIG_ERROR;
  return error;
}

function trimEnv(name: string) {
  return process.env[name]?.trim() || '';
}

export function isCloudinaryServerConfigured() {
  return Boolean(getCloudinaryCloudName() && trimEnv('CLOUDINARY_API_KEY') && trimEnv('CLOUDINARY_API_SECRET'));
}

export function ensureCloudinaryServerConfig() {
  const cloudName = getCloudinaryCloudName();
  const apiKey = trimEnv('CLOUDINARY_API_KEY');
  const apiSecret = trimEnv('CLOUDINARY_API_SECRET');

  const missing = [
    ['NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', cloudName],
    ['CLOUDINARY_API_KEY', apiKey],
    ['CLOUDINARY_API_SECRET', apiSecret],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw createConfigError(`Missing required Cloudinary environment variables: ${missing.join(', ')}`);
  }

  if (!isConfigured) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    isConfigured = true;
  }
}

function buildPublicId(sourceKey: string, kind: ImageAssetKind) {
  const withoutExtension = sourceKey.replace(/\.[a-z0-9]+$/i, '');
  return `hotam/${kind}/${withoutExtension.replace(/[^a-zA-Z0-9/_-]/g, '_')}`;
}

async function createBlurDataUrl(secureUrl: string, kind: ImageAssetKind) {
  try {
    const tinyUrl = buildCloudinaryImageUrl(secureUrl, { kind, width: 32, blur: true });
    const response = await fetch(tinyUrl, { cache: 'no-store' });
    if (!response.ok) return getImageBlurDataUrl(kind);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch {
    return getImageBlurDataUrl(kind);
  }
}

export async function uploadRemoteImageToCloudinary({
  sourceUrl,
  sourceKey,
  kind,
  ownerId,
  uploadContext,
}: {
  sourceUrl: string;
  sourceKey: string;
  kind: ImageAssetKind;
  ownerId?: string | null;
  uploadContext: 'authenticated' | 'onboarding';
}): Promise<Pick<
  ImageAssetRecord,
  'cloudinary_secure_url' | 'cloudinary_public_id' | 'width' | 'height' | 'blur_data_url' | 'migration_status'
>> {
  ensureCloudinaryServerConfig();

  const publicId = buildPublicId(sourceKey, kind);
  const response = await cloudinary.uploader.upload(sourceUrl, {
    public_id: publicId,
    overwrite: true,
    resource_type: 'image',
    tags: ['hotam', `kind:${kind}`, `context:${uploadContext}`],
    context: {
      source_url: sourceUrl,
      owner_id: ownerId || '',
      source_key: sourceKey,
    },
  });

  return {
    cloudinary_secure_url: response.secure_url,
    cloudinary_public_id: response.public_id,
    width: response.width,
    height: response.height,
    blur_data_url: await createBlurDataUrl(response.secure_url, kind),
    migration_status: 'migrated',
  };
}

export async function deleteCloudinaryImage(publicId?: string | null) {
  if (!publicId || !isCloudinaryServerConfigured()) return;
  ensureCloudinaryServerConfig();
  await cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: 'image' });
}

export { CLOUDINARY_CONFIG_ERROR };
