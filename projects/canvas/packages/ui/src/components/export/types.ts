/**
 * Export Types
 *
 * Types for canvas export functionality.
 */

import type { BoundingBox } from '@canvas/contracts';

/**
 * Supported export formats
 */
export type ExportFormat = 'png' | 'svg' | 'pdf';

/**
 * Export quality presets
 */
export type ExportQuality = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Export scope - what to export
 */
export type ExportScope = 'all' | 'selection' | 'viewport';

/**
 * Export options
 */
export interface ExportOptions {
  /** Export format */
  format: ExportFormat;
  /** Export scope */
  scope: ExportScope;
  /** Scale factor (1 = 100%, 2 = 200%, etc.) */
  scale: number;
  /** Include background */
  includeBackground: boolean;
  /** Background color (if includeBackground is true) */
  backgroundColor?: string;
  /** Padding around content in pixels */
  padding: number;
  /** Quality preset (affects compression for raster formats) */
  quality: ExportQuality;
  /** Custom filename (without extension) */
  filename?: string;
}

/**
 * Export result
 */
export interface ExportResult {
  /** Blob data */
  blob: Blob;
  /** Suggested filename with extension */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Export dimensions */
  dimensions: { width: number; height: number };
  /** Size in bytes */
  size: number;
}

/**
 * Export progress state
 */
export type ExportState = 'idle' | 'preparing' | 'rendering' | 'encoding' | 'complete' | 'error';

/**
 * Export error
 */
export interface ExportError {
  code: 'EMPTY_SELECTION' | 'RENDER_FAILED' | 'ENCODE_FAILED' | 'UNSUPPORTED_FORMAT';
  message: string;
}

/**
 * Default export options
 */
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: 'png',
  scope: 'all',
  scale: 1,
  includeBackground: true,
  backgroundColor: '#1a1a1a',
  padding: 20,
  quality: 'high',
};

/**
 * Quality to scale mapping for different formats
 */
export const QUALITY_SCALES: Record<ExportQuality, number> = {
  low: 0.5,
  medium: 1,
  high: 2,
  ultra: 4,
};

/**
 * MIME types for export formats
 */
export const FORMAT_MIME_TYPES: Record<ExportFormat, string> = {
  png: 'image/png',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
};

/**
 * File extensions for export formats
 */
export const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  png: '.png',
  svg: '.svg',
  pdf: '.pdf',
};

/**
 * Calculate export bounds based on scope
 */
export function calculateExportBounds(
  scope: ExportScope,
  allObjectsBounds: BoundingBox | null,
  selectionBounds: BoundingBox | null,
  viewportBounds: BoundingBox
): BoundingBox | null {
  switch (scope) {
    case 'selection':
      return selectionBounds;
    case 'viewport':
      return viewportBounds;
    case 'all':
    default:
      return allObjectsBounds;
  }
}

/**
 * Generate a filename for export
 */
export function generateExportFilename(
  format: ExportFormat,
  customName?: string
): string {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  const baseName = customName || `canvas-export-${timestamp}`;
  return `${baseName}${FORMAT_EXTENSIONS[format]}`;
}
