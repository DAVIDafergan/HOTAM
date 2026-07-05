'use client';

// Formats a canvas/WebWorker can't decode reliably across browsers — pass these through untouched.
const SKIP_COMPRESSION_TYPES = new Set(['image/gif', 'image/heic', 'image/heif']);

const MAX_SIZE_MB = 1.5;
const MAX_DIMENSION = 1920;
const MIN_SIZE_TO_COMPRESS_BYTES = 300 * 1024; // Not worth spending CPU on small files.

export async function compressImageFile(file: File): Promise<File> {
  if (typeof window === 'undefined') return file;
  if (!file.type.startsWith('image/') || SKIP_COMPRESSION_TYPES.has(file.type)) return file;
  if (file.size <= MIN_SIZE_TO_COMPRESS_BYTES) return file;

  try {
    const imageCompression = (await import('browser-image-compression')).default;
    const compressed = await imageCompression(file, {
      maxSizeMB: MAX_SIZE_MB,
      maxWidthOrHeight: MAX_DIMENSION,
      useWebWorker: true,
      initialQuality: 0.82,
      fileType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
    });

    // Never ship a "compressed" file that's larger than the original.
    if (compressed.size >= file.size) return file;

    return new File([compressed], file.name, {
      type: compressed.type || file.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn('Image compression failed, uploading original file instead.', error);
    return file;
  }
}
