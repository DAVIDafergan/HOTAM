
import { ImageLoaderProps } from 'next/image';

/**
 * Custom loader for Unsplash images to force server-side resizing.
 * This ensures we request exactly the width needed for the layout slot.
 */
export default function unsplashLoader({ src, width, quality }: ImageLoaderProps) {
  // Safe checks for non-string or empty sources to prevent SSR crashes
  if (!src || typeof src !== 'string' || src === '' || src.startsWith('data:')) {
    return src || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }

  // If the image is not from Unsplash, return the original src as is
  if (!src.includes('images.unsplash.com')) {
    return src;
  }
  
  // Extract the base URL without existing query parameters
  const baseUrl = src.split('?')[0];
  
  // Return the Unsplash URL with optimized parameters
  // w: width, q: quality, auto: format (converts to WebP/AVIF if supported)
  return `${baseUrl}?w=${width}&q=${quality || 75}&auto=format`;
}
