'use client';

import { useEffect, useState } from 'react';
import NextImage, { type ImageLoader, type ImageLoaderProps, type ImageProps } from 'next/image';
import { ImageOff } from 'lucide-react';
import {
  type ImageAssetKind,
  buildCloudinaryFastUploadUrl,
  getImageBlurDataUrl,
  getImageSizes,
  isCloudinaryConfigured,
  isS3Url,
  isUnsplashUrl,
  smartImageLoader,
} from '@/lib/cloudinary-shared';
import unsplashLoader from '@/lib/unsplashLoader';
import { cn } from '@/lib/utils';

export type SmartImageProps = Omit<ImageProps, 'loader'> & {
  kind?: ImageAssetKind;
  loader?: ImageLoader;
  blurDataURL?: string;
};

export default function SmartImage({
  src,
  kind = 'generic',
  sizes,
  priority,
  loading,
  placeholder,
  blurDataURL,
  loader,
  className,
  onError,
  alt,
  ...props
}: SmartImageProps) {
  const [failed, setFailed] = useState(false);
  const [fastPathFailed, setFastPathFailed] = useState(false);

  // A new src (e.g. the same slot reused for a different item) deserves a fresh try.
  useEffect(() => {
    setFailed(false);
    setFastPathFailed(false);
  }, [src]);

  const stringSrc = typeof src === 'string' ? src : '';
  const resolvedSizes = sizes || (props.fill ? getImageSizes(kind) : undefined);
  const resolvedBlurDataUrl = blurDataURL || getImageBlurDataUrl(kind);
  const resolvedPlaceholder = placeholder || (stringSrc && !stringSrc.startsWith('data:') ? 'blur' : undefined);

  // Every upload gets mirrored to a permanent, publicly-cached Cloudinary asset in the
  // background (see /api/upload-image/complete) — but the raw S3/CloudFront URL is what
  // stays stored on the product/seller row. Rebuild that asset's URL deterministically (no
  // lookup) and try it first; a 404 (mirror not landed yet, or never will) falls back to the
  // slower but always-correct on-demand `image/fetch` transform.
  const canTryFastPath = !fastPathFailed && isCloudinaryConfigured() && isS3Url(stringSrc);

  const resolvedLoader =
    typeof src !== 'string'
      ? undefined
      : isUnsplashUrl(stringSrc)
        ? loader || unsplashLoader
        : canTryFastPath
          ? ((loaderFnParams: ImageLoaderProps) =>
              buildCloudinaryFastUploadUrl(loaderFnParams.src, { kind, width: loaderFnParams.width, quality: loaderFnParams.quality }) ||
              smartImageLoader({ ...loaderFnParams, kind }))
          : ((loaderFnParams: ImageLoaderProps) => smartImageLoader({ ...loaderFnParams, kind }));

  if (failed) {
    const altText = typeof alt === 'string' && alt ? alt : 'לא ניתן להציג תמונה';
    return (
      <div
        role="img"
        aria-label={altText}
        className={cn(
          'flex flex-col items-center justify-center gap-1.5 bg-muted text-muted-foreground',
          props.fill ? 'absolute inset-0' : '',
          className
        )}
        style={!props.fill ? { width: props.width, height: props.height } : undefined}
      >
        <ImageOff className="h-6 w-6 opacity-60" aria-hidden="true" />
        <span className="text-[11px] font-medium px-2 text-center">לא ניתן להציג תמונה</span>
      </div>
    );
  }

  return (
    <NextImage
      // Force a clean remount when we drop from the fast path to the fallback loader —
      // Next/Image doesn't reliably re-resolve its internal src/srcSet from a loader
      // identity change alone, so a fresh element guarantees the retry actually fires.
      key={canTryFastPath ? 'fast' : 'fallback'}
      {...props}
      src={src}
      alt={alt}
      loader={resolvedLoader}
      sizes={resolvedSizes}
      priority={priority}
      loading={priority ? 'eager' : (loading ?? 'lazy')}
      placeholder={resolvedPlaceholder}
      blurDataURL={resolvedBlurDataUrl}
      className={className}
      onError={(event) => {
        if (canTryFastPath) {
          setFastPathFailed(true);
          return;
        }
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
