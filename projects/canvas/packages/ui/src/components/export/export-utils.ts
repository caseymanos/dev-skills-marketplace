/**
 * Export Utilities
 *
 * Functions for exporting canvas content to various formats.
 */

import type { BoundingBox, ImageObject, CanvasObject } from '@canvas/contracts';
import type {
  ExportOptions,
  ExportResult,
  ExportFormat,
} from './types';
import {
  FORMAT_MIME_TYPES,
  QUALITY_SCALES,
  generateExportFilename,
} from './types';

/**
 * Create an offscreen canvas for rendering
 */
function createOffscreenCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context');
  }
  return { canvas, ctx };
}

/**
 * Export to PNG format
 */
export async function exportToPng(
  bounds: BoundingBox,
  objects: CanvasObject[],
  images: ImageObject[],
  options: ExportOptions
): Promise<ExportResult> {
  const scale = options.scale * QUALITY_SCALES[options.quality];
  const padding = options.padding * scale;

  const exportWidth = Math.ceil(bounds.width * scale + padding * 2);
  const exportHeight = Math.ceil(bounds.height * scale + padding * 2);

  const { canvas, ctx } = createOffscreenCanvas(exportWidth, exportHeight);

  // Fill background
  if (options.includeBackground) {
    ctx.fillStyle = options.backgroundColor || '#1a1a1a';
    ctx.fillRect(0, 0, exportWidth, exportHeight);
  }

  // Apply transform to center content with padding
  ctx.translate(padding - bounds.x * scale, padding - bounds.y * scale);
  ctx.scale(scale, scale);

  // Render images
  await renderImages(ctx, images, bounds);

  // Render vector objects
  renderObjects(ctx, objects);

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create PNG blob'));
      },
      'image/png',
      1.0
    );
  });

  return {
    blob,
    filename: generateExportFilename('png', options.filename),
    mimeType: FORMAT_MIME_TYPES.png,
    dimensions: { width: exportWidth, height: exportHeight },
    size: blob.size,
  };
}

/**
 * Export to SVG format
 */
export async function exportToSvg(
  bounds: BoundingBox,
  objects: CanvasObject[],
  images: ImageObject[],
  options: ExportOptions
): Promise<ExportResult> {
  const padding = options.padding;
  const width = bounds.width + padding * 2;
  const height = bounds.height + padding * 2;

  // Build SVG string
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
`;

  // Add background
  if (options.includeBackground) {
    svg += `  <rect width="100%" height="100%" fill="${options.backgroundColor || '#1a1a1a'}"/>
`;
  }

  // Create a group with transform
  svg += `  <g transform="translate(${padding - bounds.x}, ${padding - bounds.y})">
`;

  // Add images
  for (const img of images) {
    const x = img.transform.tx;
    const y = img.transform.ty;
    svg += `    <image href="${img.src}" x="${x}" y="${y}" width="${img.width}" height="${img.height}" preserveAspectRatio="none"/>
`;
  }

  // Add vector objects
  for (const obj of objects) {
    svg += objectToSvgElement(obj);
  }

  svg += `  </g>
</svg>`;

  const blob = new Blob([svg], { type: FORMAT_MIME_TYPES.svg });

  return {
    blob,
    filename: generateExportFilename('svg', options.filename),
    mimeType: FORMAT_MIME_TYPES.svg,
    dimensions: { width, height },
    size: blob.size,
  };
}

/**
 * Export to PDF format (basic implementation using canvas)
 */
export async function exportToPdf(
  bounds: BoundingBox,
  objects: CanvasObject[],
  images: ImageObject[],
  options: ExportOptions
): Promise<ExportResult> {
  // For PDF, we first render to PNG then embed
  // A proper PDF implementation would use a library like jsPDF
  const pngResult = await exportToPng(bounds, objects, images, {
    ...options,
    format: 'png',
  });

  // Create a basic PDF with embedded image
  // This is a minimal PDF that embeds the PNG
  const pdfContent = await createBasicPdf(
    pngResult.blob,
    pngResult.dimensions.width,
    pngResult.dimensions.height
  );

  return {
    blob: pdfContent,
    filename: generateExportFilename('pdf', options.filename),
    mimeType: FORMAT_MIME_TYPES.pdf,
    dimensions: pngResult.dimensions,
    size: pdfContent.size,
  };
}

/**
 * Create a basic PDF with embedded image
 * This is a minimal implementation - production would use jsPDF or similar
 */
async function createBasicPdf(
  imageBlob: Blob,
  width: number,
  height: number
): Promise<Blob> {
  // Convert image to base64
  const arrayBuffer = await imageBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  // Create minimal PDF structure
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>
endobj

4 0 obj
<< /Length 44 >>
stream
q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q
endstream
endobj

5 0 obj
<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${base64.length} >>
stream
${atob(base64)}
endstream
endobj

xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000360 00000 n

trailer
<< /Size 6 /Root 1 0 R >>
startxref
${500 + base64.length}
%%EOF`;

  return new Blob([pdf], { type: FORMAT_MIME_TYPES.pdf });
}

/**
 * Render images to canvas context
 */
async function renderImages(
  ctx: CanvasRenderingContext2D,
  images: ImageObject[],
  _bounds: BoundingBox
): Promise<void> {
  for (const imgObj of images) {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${imgObj.id}`));
      img.src = imgObj.src;
    });

    ctx.save();
    ctx.globalAlpha = imgObj.opacity ?? 1;
    ctx.drawImage(
      img,
      imgObj.transform.tx,
      imgObj.transform.ty,
      imgObj.width,
      imgObj.height
    );
    ctx.restore();
  }
}

/**
 * Render vector objects to canvas context
 */
function renderObjects(ctx: CanvasRenderingContext2D, objects: CanvasObject[]): void {
  for (const obj of objects) {
    if (!obj.visible) continue;

    ctx.save();

    // Apply transform
    ctx.transform(
      obj.transform.a,
      obj.transform.b,
      obj.transform.c,
      obj.transform.d,
      obj.transform.tx,
      obj.transform.ty
    );

    switch (obj.type) {
      case 'rectangle':
        renderRectangle(ctx, obj);
        break;
      case 'ellipse':
        renderEllipse(ctx, obj);
        break;
      case 'line':
        renderLine(ctx, obj);
        break;
      case 'text':
        renderText(ctx, obj);
        break;
    }

    ctx.restore();
  }
}

/**
 * Render a rectangle
 */
function renderRectangle(ctx: CanvasRenderingContext2D, obj: CanvasObject): void {
  if (obj.type !== 'rectangle') return;

  if (obj.fill) {
    ctx.fillStyle = colorToRgba(obj.fill);
    if (obj.cornerRadius > 0) {
      roundRect(ctx, 0, 0, obj.width, obj.height, obj.cornerRadius);
      ctx.fill();
    } else {
      ctx.fillRect(0, 0, obj.width, obj.height);
    }
  }

  if (obj.stroke && obj.strokeWidth > 0) {
    ctx.strokeStyle = colorToRgba(obj.stroke);
    ctx.lineWidth = obj.strokeWidth;
    if (obj.cornerRadius > 0) {
      roundRect(ctx, 0, 0, obj.width, obj.height, obj.cornerRadius);
      ctx.stroke();
    } else {
      ctx.strokeRect(0, 0, obj.width, obj.height);
    }
  }
}

/**
 * Render an ellipse
 */
function renderEllipse(ctx: CanvasRenderingContext2D, obj: CanvasObject): void {
  if (obj.type !== 'ellipse') return;

  ctx.beginPath();
  ctx.ellipse(obj.radiusX, obj.radiusY, obj.radiusX, obj.radiusY, 0, 0, Math.PI * 2);

  if (obj.fill) {
    ctx.fillStyle = colorToRgba(obj.fill);
    ctx.fill();
  }

  if (obj.stroke && obj.strokeWidth > 0) {
    ctx.strokeStyle = colorToRgba(obj.stroke);
    ctx.lineWidth = obj.strokeWidth;
    ctx.stroke();
  }
}

/**
 * Render a line
 */
function renderLine(ctx: CanvasRenderingContext2D, obj: CanvasObject): void {
  if (obj.type !== 'line') return;

  ctx.beginPath();
  ctx.moveTo(obj.startPoint.x, obj.startPoint.y);
  ctx.lineTo(obj.endPoint.x, obj.endPoint.y);
  ctx.strokeStyle = colorToRgba(obj.stroke);
  ctx.lineWidth = obj.strokeWidth;
  ctx.stroke();
}

/**
 * Render text
 */
function renderText(ctx: CanvasRenderingContext2D, obj: CanvasObject): void {
  if (obj.type !== 'text') return;

  ctx.font = `${obj.fontSize}px ${obj.fontFamily}`;
  ctx.fillStyle = colorToRgba(obj.fill);
  ctx.textAlign = obj.textAlign;
  ctx.fillText(obj.content, 0, obj.fontSize);
}

/**
 * Convert a color object to rgba string
 */
function colorToRgba(color: { r: number; g: number; b: number; a: number }): string {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
}

/**
 * Draw a rounded rectangle path
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Convert a canvas object to SVG element string
 */
function objectToSvgElement(obj: CanvasObject): string {
  if (!obj.visible) return '';

  const transform = `transform="matrix(${obj.transform.a},${obj.transform.b},${obj.transform.c},${obj.transform.d},${obj.transform.tx},${obj.transform.ty})"`;

  switch (obj.type) {
    case 'rectangle': {
      const fill = obj.fill ? colorToRgba(obj.fill) : 'none';
      const stroke = obj.stroke ? colorToRgba(obj.stroke) : 'none';
      if (obj.cornerRadius > 0) {
        return `    <rect x="0" y="0" width="${obj.width}" height="${obj.height}" rx="${obj.cornerRadius}" fill="${fill}" stroke="${stroke}" stroke-width="${obj.strokeWidth}" ${transform}/>
`;
      }
      return `    <rect x="0" y="0" width="${obj.width}" height="${obj.height}" fill="${fill}" stroke="${stroke}" stroke-width="${obj.strokeWidth}" ${transform}/>
`;
    }

    case 'ellipse': {
      const fill = obj.fill ? colorToRgba(obj.fill) : 'none';
      const stroke = obj.stroke ? colorToRgba(obj.stroke) : 'none';
      return `    <ellipse cx="${obj.radiusX}" cy="${obj.radiusY}" rx="${obj.radiusX}" ry="${obj.radiusY}" fill="${fill}" stroke="${stroke}" stroke-width="${obj.strokeWidth}" ${transform}/>
`;
    }

    case 'line': {
      const stroke = colorToRgba(obj.stroke);
      return `    <line x1="${obj.startPoint.x}" y1="${obj.startPoint.y}" x2="${obj.endPoint.x}" y2="${obj.endPoint.y}" stroke="${stroke}" stroke-width="${obj.strokeWidth}" ${transform}/>
`;
    }

    case 'text': {
      const fill = colorToRgba(obj.fill);
      return `    <text x="0" y="${obj.fontSize}" fill="${fill}" font-size="${obj.fontSize}" font-family="${obj.fontFamily}" text-anchor="${obj.textAlign === 'center' ? 'middle' : obj.textAlign === 'right' ? 'end' : 'start'}" ${transform}>${escapeXml(obj.content)}</text>
`;
    }

    default:
      return '';
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Main export function
 */
export async function exportCanvas(
  format: ExportFormat,
  bounds: BoundingBox,
  objects: CanvasObject[],
  images: ImageObject[],
  options: ExportOptions
): Promise<ExportResult> {
  switch (format) {
    case 'png':
      return exportToPng(bounds, objects, images, options);
    case 'svg':
      return exportToSvg(bounds, objects, images, options);
    case 'pdf':
      return exportToPdf(bounds, objects, images, options);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

/**
 * Trigger download of export result
 */
export function downloadExport(result: ExportResult): void {
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
