/**
 * Media Types
 *
 * Types for image and media handling.
 */

import type { BoundingBox, Point } from '@canvas/contracts';

/**
 * Supported image formats
 */
export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'image/svg+xml';

/**
 * Image loading state
 */
export type ImageLoadState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * Loaded image data
 */
export interface LoadedImage {
  /** Image source (URL or data URI) */
  src: string;
  /** HTMLImageElement for rendering */
  element: HTMLImageElement;
  /** Natural width in pixels */
  naturalWidth: number;
  /** Natural height in pixels */
  naturalHeight: number;
  /** Aspect ratio (width / height) */
  aspectRatio: number;
}

/**
 * Image upload result
 */
export interface ImageUploadResult {
  /** Unique ID for tracking */
  id: string;
  /** Image source (data URI for local files, URL for remote) */
  src: string;
  /** File name if from file upload */
  fileName?: string;
  /** File size in bytes */
  fileSize?: number;
  /** MIME type */
  mimeType: ImageFormat;
  /** Natural dimensions */
  naturalWidth: number;
  naturalHeight: number;
}

/**
 * Image drop zone state
 */
export interface DropZoneState {
  /** Whether currently dragging over */
  isDragOver: boolean;
  /** Whether drop is allowed (valid file type) */
  isValidDrop: boolean;
}

/**
 * Image placement options
 */
export interface ImagePlacementOptions {
  /** Initial position (center of viewport if not provided) */
  position?: Point;
  /** Maximum initial size (fits within while preserving aspect ratio) */
  maxSize?: { width: number; height: number };
  /** Whether to auto-select after placing */
  autoSelect?: boolean;
}

/**
 * Default max image size for initial placement (prevents huge images)
 */
export const DEFAULT_MAX_IMAGE_SIZE = {
  width: 800,
  height: 600,
};

/**
 * Supported drop file types
 */
export const SUPPORTED_IMAGE_TYPES: ImageFormat[] = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

/**
 * Calculate scaled dimensions while preserving aspect ratio
 */
export function calculateFitDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const aspectRatio = naturalWidth / naturalHeight;

  let width = naturalWidth;
  let height = naturalHeight;

  // Scale down if exceeds max width
  if (width > maxWidth) {
    width = maxWidth;
    height = width / aspectRatio;
  }

  // Scale down if still exceeds max height
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return { width, height };
}

/**
 * Convert bounds to centered position
 */
export function boundsToCenter(bounds: BoundingBox): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}
