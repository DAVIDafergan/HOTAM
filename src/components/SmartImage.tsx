'use client';

import NextImage, { type ImageProps, type ImageLoader } from 'next/image';
import { type ImageAssetKind, getImageBlurDataUrl, getImageSizes, isUnsplashUrl, smartImageLoader } from '@/lib/cloudinary-shared';
import unsplashLoader from '@/lib/unsplashLoader';

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
  ...props
}: SmartImageProps) {
  const stringSrc = typeof src === 'string' ? src : '';
  const resolvedSizes = sizes || (props.fill ? getImageSizes(kind) : undefined);
  const resolvedBlurDataUrl = blurDataURL || getImageBlurDataUrl(kind);
  const resolvedPlaceholder = placeholder || (stringSrc && !stringSrc.startsWith('data:') ? 'blur' : undefined);
  const resolvedLoader =
    typeof src !== 'string'
      ? undefined
      : isUnsplashUrl(stringSrc)
        ? loader || unsplashLoader
        : (loaderFnParams => smartImageLoader({ ...loaderFnParams, kind }));

  return (
    <NextImage
      {...props}
      src={src}
      loader={resolvedLoader}
      sizes={resolvedSizes}
      priority={priority}
      loading={priority ? 'eager' : (loading ?? 'lazy')}
      placeholder={resolvedPlaceholder}
      blurDataURL={resolvedBlurDataUrl}
    />
  );
}
