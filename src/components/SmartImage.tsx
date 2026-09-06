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
  // Last-resort tier: if every Cloudinary-based attempt fails — the deterministic fast-path
  // guess 404s (mirror hasn't landed yet) AND the on-demand image/fetch transform also fails
  // (e.g. this Cloudinary account doesn't have remote-fetch delivery enabled for this domain,
  // a common default-security gotcha that doesn't show up until Cloudinary env vars are
  // actually set) — fall through to Next's own built-in image optimizer with no custom loader
  // at all. That only depends on the source being reachable and its host being listed in
  // next.config.ts's remotePatterns, not on any third-party account setting, so a freshly
  // uploaded image never has to dead-end as "can't display this image".
  const [rawFallback, setRawFallback] = useState(false);

  // A new src (e.g. the same slot reused for a different item) deserves a fresh try.
  useEffect(() => {
    setFailed(false);
    setFastPathFailed(false);
    setRawFallback(false);
  }, [src]);

  const stringSrc = typeof src === 'string' ? src : '';
  const resolvedSizes = sizes || (props.fill ? getImageSizes(kind) : undefined);
  const resolvedBlurDataUrl = blurDataURL || getImageBlurDataUrl(kind);
  const resolvedPlaceholder = placeholder || (stringSrc && !stringSrc.startsWith('data:') ? 'blur' : undefined);

  // The unsplash loader isn't part of the Cloudinary chain the raw-fallback tier exists for,
  // so it's excluded from that retry (nothing to fall back from).
  const isUnsplash = isUnsplashUrl(stringSrc);

  // Every upload gets mirrored to a permanent, publicly-cached Cloudinary asset in the
  // background (see /api/upload-image/complete) — but the raw S3/CloudFront URL is what
  // stays stored on the product/seller row. Rebuild that asset's URL deterministically (no
  // lookup) and try it first; a 404 (mirror not landed yet, or never will) falls back to the
  // slower but always-correct on-demand `image/fetch` transform.
  const canTryFastPath = !fastPathFailed && !rawFallback && isCloudinaryConfigured() && isS3Url(stringSrc);

  const resolvedLoader =
    typeof src !== 'string'
      ? undefined
      : rawFallback && !isUnsplash
        ? undefined
        : isUnsplash
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
      // Force a clean remount on every tier change — Next/Image doesn't reliably re-resolve
      // its internal src/srcSet from a loader identity change alone, so a fresh element
      // guarantees each retry actually fires.
      key={rawFallback && !isUnsplash ? 'raw' : canTryFastPath ? 'fast' : 'fallback'}
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
        if (!isUnsplash && !rawFallback) {
          setRawFallback(true);
          return;
        }
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}
