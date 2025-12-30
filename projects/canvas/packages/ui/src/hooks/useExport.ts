/**
 * useExport Hook
 *
 * Provides export functionality for PNG, SVG, and PDF formats.
 */

import { useCallback, useState } from 'react';
import type { ExportOptions, CanvasEngine, BoundingBox } from '@canvas/contracts';

export type ExportFormat = 'png' | 'svg' | 'pdf';

export interface ExportResult {
  blob: Blob;
  url: string;
  fileName: string;
  format: ExportFormat;
}

export interface UseExportOptions {
  /** Default file name prefix */
  fileNamePrefix?: string;
  /** Default scale for exports */
  defaultScale?: number;
}

export interface UseExportReturn {
  /** Whether export is in progress */
  isExporting: boolean;
  /** Error message if export failed */
  error: string | null;
  /** Export to PNG format */
  exportPng: (engine: CanvasEngine, options?: ExportOptions) => Promise<ExportResult | null>;
  /** Export to SVG format */
  exportSvg: (engine: CanvasEngine, options?: ExportOptions) => Promise<ExportResult | null>;
  /** Export to PDF format */
  exportPdf: (engine: CanvasEngine, options?: ExportOptions) => Promise<ExportResult | null>;
  /** Download the export result */
  download: (result: ExportResult) => void;
  /** Export and immediately download */
  exportAndDownload: (
    engine: CanvasEngine,
    format: ExportFormat,
    options?: ExportOptions
  ) => Promise<void>;
}

/**
 * Generate a timestamp-based file name
 */
function generateFileName(prefix: string, format: ExportFormat): string {
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `${prefix}-${timestamp}.${format}`;
}

/**
 * Convert SVG string to PDF Blob using canvas
 * Note: This is a simplified implementation. For production,
 * consider using a library like jsPDF or pdfkit.
 */
async function svgToPdf(svgString: string, bounds: BoundingBox): Promise<Blob> {
  // Create canvas to render SVG
  const canvas = document.createElement('canvas');
  const scale = 2; // 2x for better quality
  canvas.width = bounds.width * scale;
  canvas.height = bounds.height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Create image from SVG
  const img = new Image();
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load SVG'));
    img.src = url;
  });

  URL.revokeObjectURL(url);

  // Draw image to canvas
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);

  // Convert to PDF-like format (using PNG as fallback)
  // In production, use a proper PDF library
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create PDF'));
        }
      },
      'image/png',
      1.0
    );
  });
}

/**
 * Hook for export functionality
 */
export function useExport(options: UseExportOptions = {}): UseExportReturn {
  const { fileNamePrefix = 'canvas-export', defaultScale = 1 } = options;

  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportPng = useCallback(
    async (
      engine: CanvasEngine,
      exportOptions?: ExportOptions
    ): Promise<ExportResult | null> => {
      setIsExporting(true);
      setError(null);

      try {
        const mergedOptions: ExportOptions = {
          scale: defaultScale,
          ...exportOptions,
        };

        const blob = await engine.exportToPng(mergedOptions);
        const url = URL.createObjectURL(blob);
        const fileName = generateFileName(fileNamePrefix, 'png');

        return {
          blob,
          url,
          fileName,
          format: 'png',
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to export PNG';
        setError(message);
        return null;
      } finally {
        setIsExporting(false);
      }
    },
    [fileNamePrefix, defaultScale]
  );

  const exportSvg = useCallback(
    async (
      engine: CanvasEngine,
      exportOptions?: ExportOptions
    ): Promise<ExportResult | null> => {
      setIsExporting(true);
      setError(null);

      try {
        const mergedOptions: ExportOptions = {
          scale: defaultScale,
          ...exportOptions,
        };

        const svgString = await engine.exportToSvg(mergedOptions);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const fileName = generateFileName(fileNamePrefix, 'svg');

        return {
          blob,
          url,
          fileName,
          format: 'svg',
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to export SVG';
        setError(message);
        return null;
      } finally {
        setIsExporting(false);
      }
    },
    [fileNamePrefix, defaultScale]
  );

  const exportPdf = useCallback(
    async (
      engine: CanvasEngine,
      exportOptions?: ExportOptions
    ): Promise<ExportResult | null> => {
      setIsExporting(true);
      setError(null);

      try {
        const mergedOptions: ExportOptions = {
          scale: defaultScale,
          ...exportOptions,
        };

        // Get SVG first, then convert to PDF
        const svgString = await engine.exportToSvg(mergedOptions);

        // Get bounds for PDF dimensions
        const selection = engine.getSelection();
        const bounds = selection.bounds || { x: 0, y: 0, width: 800, height: 600 };

        const blob = await svgToPdf(svgString, bounds);
        const url = URL.createObjectURL(blob);
        const fileName = generateFileName(fileNamePrefix, 'pdf');

        return {
          blob,
          url,
          fileName,
          format: 'pdf',
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to export PDF';
        setError(message);
        return null;
      } finally {
        setIsExporting(false);
      }
    },
    [fileNamePrefix, defaultScale]
  );

  const download = useCallback((result: ExportResult) => {
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up URL after download
    setTimeout(() => URL.revokeObjectURL(result.url), 100);
  }, []);

  const exportAndDownload = useCallback(
    async (
      engine: CanvasEngine,
      format: ExportFormat,
      exportOptions?: ExportOptions
    ): Promise<void> => {
      let result: ExportResult | null = null;

      switch (format) {
        case 'png':
          result = await exportPng(engine, exportOptions);
          break;
        case 'svg':
          result = await exportSvg(engine, exportOptions);
          break;
        case 'pdf':
          result = await exportPdf(engine, exportOptions);
          break;
      }

      if (result) {
        download(result);
      }
    },
    [exportPng, exportSvg, exportPdf, download]
  );

  return {
    isExporting,
    error,
    exportPng,
    exportSvg,
    exportPdf,
    download,
    exportAndDownload,
  };
}

export default useExport;
