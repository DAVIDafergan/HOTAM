import type { ImageLoaderProps } from 'next/image';

export type ImageAssetKind =
  | 'product'
  | 'avatar'
  | 'article'
  | 'certificate'
  | 'hero'
  | 'writing_sample'
  | 'generic';

export type ImageMigrationStatus = 'pending' | 'migrated' | 'failed' | 'deleted';

export type ImageAssetRecord = {
  id?: string;
  source_key?: string | null;
  source_url?: string | null;
  delivery_url?: string | null;
  original_s3_url?: string | null;
  cloudinary_secure_url?: string | null;
  cloudinary_public_id?: string | null;
  width?: number | null;
  height?: number | null;
  blur_data_url?: string | null;
  kind?: ImageAssetKind | null;
  migration_status?: ImageMigrationStatus | null;
  upload_context?: 'authenticated' | 'onboarding' | null;
  owner_id?: string | null;
  created_at?: string;
  updated_at?: string;
};

type TransformConfig = {
  crop?: string;
  gravity?: string;
  aspectRatio?: string;
  width?: number;
  height?: number;
  quality?: string;
  effect?: string;
  background?: string;
};

const BLANK_IMAGE_DATA_URL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const CLOUDINARY_HOST = 'res.cloudinary.com';
const DEFAULT_CLOUDINARY_QUALITY = 'auto';

const DEFAULT_KIND_BY_PREFIX: Record<string, ImageAssetKind> = {
  onboarding: 'certificate',
  products: 'product',
};

const DEFAULT_SIZES_BY_KIND: Record<ImageAssetKind, string> = {
  product: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
  avatar: '(max-width: 640px) 96px, 128px',
  article: '(max-width: 768px) 100vw, 50vw',
  certificate: '(max-width: 768px) 100vw, 720px',
  hero: '100vw',
  writing_sample: '(max-width: 640px) 50vw, 25vw',
  generic: '100vw',
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toBase64(value: string) {
  if (typeof window === 'undefined') {
    return Buffer.from(value).toString('base64');
  }

  return window.btoa(unescape(encodeURIComponent(value)));
}

function normalizeWidth(width?: number): number | undefined {
  if (!width || !Number.isFinite(width)) return undefined;
  return clamp(Math.round(width), 32, 2400);
}

function encodeCloudinaryFetchUrl(src: string): string {
  return encodeURIComponent(src).replace(/%2F/g, '/');
}

function buildTransformSegments({
  width,
  height,
  crop,
  gravity,
  quality,
  effect,
  background,
  aspectRatio,
}: TransformConfig) {
  return [
    crop ? `c_${crop}` : '',
    gravity ? `g_${gravity}` : '',
    aspectRatio ? `ar_${aspectRatio}` : '',
    width ? `w_${width}` : '',
    height ? `h_${height}` : '',
    background ? `b_${background}` : '',
    `q_${quality || DEFAULT_CLOUDINARY_QUALITY}`,
    'f_auto',
    effect || '',
  ].filter(Boolean);
}

function getTransformConfig(kind: ImageAssetKind, width?: number, quality?: number): TransformConfig {
  const resolvedWidth = normalizeWidth(width);
  const resolvedQuality = quality ? String(clamp(quality, 1, 100)) : undefined;

  switch (kind) {
    case 'avatar':
      return {
        crop: 'fill',
        gravity: 'face',
        width: resolvedWidth,
        height: resolvedWidth,
        quality: resolvedQuality || 'auto:eco',
        background: 'auto',
      };
    case 'article':
      return {
        crop: 'fill',
        gravity: 'auto',
        aspectRatio: '16:9',
        width: resolvedWidth,
        quality: resolvedQuality || 'auto:good',
      };
    case 'certificate':
      return {
        crop: 'fit',
        gravity: 'auto',
        width: resolvedWidth,
        quality: resolvedQuality || 'auto:best',
        background: 'white',
      };
    case 'hero':
      return {
        crop: 'fill',
        gravity: 'auto',
        width: resolvedWidth,
        quality: resolvedQuality || 'auto:good',
      };
    case 'writing_sample':
      return {
        crop: 'fill',
        gravity: 'auto',
        aspectRatio: '1:1',
        width: resolvedWidth,
        quality: resolvedQuality || 'auto:good',
      };
    case 'product':
      return {
        crop: 'fill',
        gravity: 'auto',
        aspectRatio: '1:1',
        width: resolvedWidth,
        quality: resolvedQuality || 'auto:eco',
        effect: 'fl_progressive',
      };
    default:
      return {
        crop: 'limit',
        width: resolvedWidth,
        quality: resolvedQuality || DEFAULT_CLOUDINARY_QUALITY,
      };
  }
}

function buildBlurTransformSegments(kind: ImageAssetKind) {
  const config = getTransformConfig(kind, 32, 20);
  return buildTransformSegments({
    ...config,
    width: 32,
    effect: 'e_blur:1200',
  });
}

function escapeSvgText(value: string) {
  return value.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return char;
    }
  });
}

export function getCloudinaryCloudName() {
  return process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim() || '';
}

export function isCloudinaryConfigured() {
  return Boolean(getCloudinaryCloudName());
}

export function isCloudinaryUrl(src?: string | null) {
  return Boolean(src && src.includes(CLOUDINARY_HOST));
}

export function isUnsplashUrl(src?: string | null) {
  return Boolean(src && src.includes('images.unsplash.com'));
}

export function isS3Url(src?: string | null) {
  if (!src) return false;

  try {
    const { hostname } = new URL(src);
    return (
      hostname === 'amazonaws.com' ||
      hostname.endsWith('.amazonaws.com') ||
      hostname === 'cloudfront.net' ||
      hostname.endsWith('.cloudfront.net')
    );
  } catch {
    return false;
  }
}

export function isRemoteImageUrl(src?: string | null) {
  return Boolean(src && /^https?:\/\//.test(src));
}

export function inferImageKind(
  assetKind?: ImageAssetKind | null,
  keyPrefix?: string | null,
  fallback: ImageAssetKind = 'generic'
): ImageAssetKind {
  if (assetKind) return assetKind;
  if (keyPrefix && DEFAULT_KIND_BY_PREFIX[keyPrefix]) return DEFAULT_KIND_BY_PREFIX[keyPrefix];
  return fallback;
}

export function getImageSizes(kind: ImageAssetKind = 'generic') {
  return DEFAULT_SIZES_BY_KIND[kind] || DEFAULT_SIZES_BY_KIND.generic;
}

export function getImageBlurDataUrl(kind: ImageAssetKind = 'generic') {
  const label = escapeSvgText(kind.replace('_', ' '));
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" preserveAspectRatio="none">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f5efe3" />
          <stop offset="50%" stop-color="#efe4ca" />
          <stop offset="100%" stop-color="#f8f5eb" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" fill="url(#g)" />
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="rgba(90,72,32,0.22)" font-size="3" font-family="Arial, sans-serif">${label}</text>
    </svg>
  `;

  return `data:image/svg+xml;base64,${toBase64(svg)}`;
}

export function buildCloudinaryImageUrl(
  src: string,
  {
    kind = 'generic',
    width,
    quality,
    blur = false,
  }: {
    kind?: ImageAssetKind;
    width?: number;
    quality?: number;
    blur?: boolean;
  } = {}
) {
  if (!src || typeof src !== 'string') return BLANK_IMAGE_DATA_URL;
  if (src.startsWith('data:') || src.startsWith('/') || isUnsplashUrl(src)) return src;

  const cloudName = getCloudinaryCloudName();
  if (!cloudName || !isRemoteImageUrl(src)) return src;

  const transformSegments = blur
    ? buildBlurTransformSegments(kind)
    : buildTransformSegments(getTransformConfig(kind, width, quality));
  const transformation = transformSegments.join(',');

  if (isCloudinaryUrl(src)) {
    // Cloudinary URLs with a version segment look like: /image/upload/v1234567/public-id
    // We must insert transformations BEFORE the version, not after /upload/
    // Regex: captures optional existing transforms (group 1) and the version+slash (group 2)
    return src.replace(
      //image/upload/((?:[a-z][a-z0-9_]*_[^/,]+,?)*/?)((vd+/)?)/,
      (_, _existingTransforms, versionSegment) =>
        `/image/upload/${transformation}/${versionSegment}`
    );
  }

  return `https://${CLOUDINARY_HOST}/${cloudName}/image/fetch/${transformation}/${encodeCloudinaryFetchUrl(src)}`;
}

export function smartImageLoader({
  src,
  width,
  quality,
  kind = 'generic',
}: ImageLoaderProps & { kind?: ImageAssetKind }) {
  return buildCloudinaryImageUrl(src, { kind, width, quality });
}

export function getOptimizedImageSrc(
  src?: string | null,
  kind: ImageAssetKind = 'generic',
  width = 320,
  quality?: number
) {
  if (!src) return undefined;
  return buildCloudinaryImageUrl(src, { kind, width, quality });
}

export function getAssetDeliveryUrl(asset: Partial<ImageAssetRecord> | null | undefined) {
  if (!asset) return undefined;
  return asset.delivery_url || asset.cloudinary_secure_url || asset.source_url || asset.original_s3_url || undefined;
}
