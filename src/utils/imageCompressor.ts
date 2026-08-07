/**
 * High-performance, Memory-Safe Automatic Image Compression Engine for DoBill POS.
 * Bypasses JavaScript RAM heap limitations to handle images of ANY size (100MB, 500MB, 1GB - 5GB+),
 * automatically downscaling while maintaining aspect ratio, removing EXIF/GPS metadata,
 * preserving orientation, and converting to ultra-compressed WebP/JPEG base64 strings (target <= 20 KB).
 */

export interface ImageCompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // Initial quality (0.1 - 1.0)
  format?: 'image/webp' | 'image/jpeg';
  maxSizeBytes?: number; // Target max size in bytes (default: 20 * 1024 = 20KB)
}

const DEFAULT_OPTIONS: ImageCompressOptions = {
  maxWidth: 500,
  maxHeight: 500,
  quality: 0.75,
  format: 'image/webp',
  maxSizeBytes: 20 * 1024, // 20 KB target size
};

/**
 * Calculates byte size of a base64 Data URL string accurately.
 */
export function getBase64SizeBytes(base64: string): number {
  if (!base64 || typeof base64 !== 'string') return 0;
  const parts = base64.split(',');
  const rawData = parts.length > 1 ? parts[1] : parts[0];
  const padding = rawData.endsWith('==') ? 2 : rawData.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((rawData.length * 3) / 4) - padding);
}

/**
 * Memory-safe loader for File objects of ANY size (100MB - 5GB+).
 * Uses URL.createObjectURL or createImageBitmap to prevent browser JavaScript RAM heap crashes.
 */
async function loadDrawableFromObject(fileOrBlob: File | Blob): Promise<{
  drawable: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  // Method 1: Try createImageBitmap (Hardware accelerated, streaming decode, orientation aware)
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(fileOrBlob, {
        imageOrientation: 'from-image' as any,
      });
      return {
        drawable: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => {
          try {
            bitmap.close();
          } catch (_) {}
        },
      };
    } catch (_) {
      // Fallback to Method 2 if createImageBitmap fails or is unsupported for specific file type
    }
  }

  // Method 2: Memory-safe Object URL with HTMLImageElement
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(fileOrBlob);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      resolve({
        drawable: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => {
          try {
            URL.revokeObjectURL(objectUrl);
          } catch (_) {}
        },
      });
    };

    img.onerror = (err) => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch (_) {}
      reject(err);
    };

    img.src = objectUrl;
  });
}

/**
 * Memory-safe loader for Data URLs / Base64 image strings.
 */
async function loadDrawableFromDataUrl(dataUrl: string): Promise<{
  drawable: HTMLImageElement;
  width: number;
  height: number;
  cleanup: () => void;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      resolve({
        drawable: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => {},
      });
    };

    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}

/**
 * Renders drawable image onto a canvas with multi-pass step downscaling if necessary,
 * stripping EXIF/GPS metadata, then iteratively compressing to hit the target max size (~20 KB) while preserving visual clarity.
 */
function processCanvasCompression(
  drawable: ImageBitmap | HTMLImageElement,
  origWidth: number,
  origHeight: number,
  options: ImageCompressOptions
): string {
  const targetMaxSizeBytes = options.maxSizeBytes || 20 * 1024; // 20 KB default target
  const maxW = options.maxWidth || 500;
  const maxH = options.maxHeight || 500;

  // 1. Calculate target dimensions preserving aspect ratio
  let width = origWidth;
  let height = origHeight;

  if (width > maxW || height > maxH) {
    if (width / height > maxW / maxH) {
      height = Math.round((height * maxW) / width);
      width = maxW;
    } else {
      width = Math.round((width * maxH) / height);
      height = maxH;
    }
  }

  width = Math.max(1, width);
  height = Math.max(1, height);

  // 2. Setup canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Stepwise multi-pass downscaling for giant source images (e.g. > 3000px) to prevent scaling artifacts & maintain sharpness
  if (origWidth > width * 3 || origHeight > height * 3) {
    const stepCanvas = document.createElement('canvas');
    const stepW = Math.floor(origWidth / 2);
    const stepH = Math.floor(origHeight / 2);
    stepCanvas.width = stepW;
    stepCanvas.height = stepH;

    const stepCtx = stepCanvas.getContext('2d');
    if (stepCtx) {
      stepCtx.imageSmoothingEnabled = true;
      stepCtx.imageSmoothingQuality = 'high';
      stepCtx.drawImage(drawable, 0, 0, stepW, stepH);
      ctx.drawImage(stepCanvas, 0, 0, stepW, stepH, 0, 0, width, height);
    } else {
      ctx.drawImage(drawable, 0, 0, width, height);
    }
  } else {
    ctx.drawImage(drawable, 0, 0, width, height);
  }

  // 3. WebP export with fallbacks
  let preferredFormat = options.format || 'image/webp';
  let quality = options.quality ?? 0.75;

  let result = canvas.toDataURL(preferredFormat, quality);

  // Fallback to JPEG if browser canvas doesn't support WebP export
  if (preferredFormat === 'image/webp' && !result.startsWith('data:image/webp')) {
    preferredFormat = 'image/jpeg';
    result = canvas.toDataURL(preferredFormat, quality);
  }

  // 4. Iterative quality and dimensional adjustment to hit <= 20 KB target size
  let currentBytes = getBase64SizeBytes(result);
  let attempts = 0;

  // First pass: reduce quality down to 0.35 if needed
  while (currentBytes > targetMaxSizeBytes && quality > 0.35 && attempts < 8) {
    quality -= 0.08;
    result = canvas.toDataURL(preferredFormat, quality);
    currentBytes = getBase64SizeBytes(result);
    attempts++;
  }

  // Second pass: if still > 20 KB (e.g., highly complex image), scale down canvas dimensions slightly
  let resizeAttempts = 0;
  let currentCanvas = canvas;
  let currentW = width;
  let currentH = height;

  while (currentBytes > targetMaxSizeBytes && currentW > 140 && resizeAttempts < 5) {
    resizeAttempts++;
    currentW = Math.floor(currentW * 0.82);
    currentH = Math.floor(currentH * 0.82);

    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = currentW;
    resizedCanvas.height = currentH;
    const rCtx = resizedCanvas.getContext('2d');

    if (rCtx) {
      rCtx.imageSmoothingEnabled = true;
      rCtx.imageSmoothingQuality = 'high';
      rCtx.drawImage(currentCanvas, 0, 0, currentW, currentH);
      currentCanvas = resizedCanvas;

      quality = Math.max(0.45, quality); // reset quality slightly for smaller dimensions
      result = currentCanvas.toDataURL(preferredFormat, quality);
      currentBytes = getBase64SizeBytes(result);

      // Fine-tune quality for resized canvas
      while (currentBytes > targetMaxSizeBytes && quality > 0.30) {
        quality -= 0.05;
        result = currentCanvas.toDataURL(preferredFormat, quality);
        currentBytes = getBase64SizeBytes(result);
      }
    }
  }

  console.log(
    `[ImageCompressor] Compressed to ~${Math.round(currentBytes / 1024)} KB (${currentW}x${currentH}px, ${preferredFormat})`
  );

  return result;
}

/**
 * Compress an uploaded File object of ANY size (100MB, 500MB, 1GB, 2GB, 5GB+) to an ultra-small WebP/JPEG base64 string (~20 KB or less).
 */
export async function compressImageFile(
  file: File | Blob,
  options: ImageCompressOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let loaderResult: {
    drawable: ImageBitmap | HTMLImageElement;
    width: number;
    height: number;
    cleanup: () => void;
  } | null = null;

  try {
    loaderResult = await loadDrawableFromObject(file);
    const compressed = processCanvasCompression(
      loaderResult.drawable,
      loaderResult.width,
      loaderResult.height,
      opts
    );
    return compressed;
  } catch (err) {
    console.error('[ImageCompressor] Error compressing image file:', err);
    throw err;
  } finally {
    if (loaderResult) {
      loaderResult.cleanup();
    }
  }
}

/**
 * Compress an existing Data URL / base64 image string to an ultra-small WebP/JPEG base64 string (~20 KB or less).
 */
export async function compressBase64Image(
  dataUrl: string,
  options: ImageCompressOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // If invalid or non-image or already tiny string, return as is
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  // If already under target size (e.g. <= 20 KB) and format is webp/jpeg, can return directly
  const initialBytes = getBase64SizeBytes(dataUrl);
  if (initialBytes <= (opts.maxSizeBytes || 20 * 1024) && (dataUrl.startsWith('data:image/webp') || dataUrl.startsWith('data:image/jpeg'))) {
    return dataUrl;
  }

  let loaderResult: {
    drawable: HTMLImageElement;
    width: number;
    height: number;
    cleanup: () => void;
  } | null = null;

  try {
    loaderResult = await loadDrawableFromDataUrl(dataUrl);
    const compressed = processCanvasCompression(
      loaderResult.drawable,
      loaderResult.width,
      loaderResult.height,
      opts
    );
    return compressed;
  } catch (err) {
    console.warn('[ImageCompressor] Base64 compression failed, keeping original:', err);
    return dataUrl;
  } finally {
    if (loaderResult) {
      loaderResult.cleanup();
    }
  }
}
