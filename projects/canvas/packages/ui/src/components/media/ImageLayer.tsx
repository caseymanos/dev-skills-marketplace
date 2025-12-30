/**
 * ImageLayer Component
 *
 * Renders images on the canvas with proper transformations.
 * Uses an SVG overlay for rendering images with camera transforms.
 */

import { useEffect, useState, useMemo } from 'react';
import type { CameraState, ImageObject } from '@canvas/contracts';
import { canvasToScreen } from '../../events';

interface ImageLayerProps {
  /** Images to render */
  images: ImageObject[];
  /** Current camera state */
  camera: CameraState;
  /** Canvas dimensions */
  width: number;
  height: number;
  /** Selected image IDs for highlight */
  selectedIds?: string[];
  /** Called when an image is clicked */
  onImageClick?: (id: string, event: React.PointerEvent) => void;
}

interface LoadedImageElement {
  id: string;
  element: HTMLImageElement;
}

/**
 * ImageLayer renders images as an SVG overlay
 */
export function ImageLayer({
  images,
  camera,
  width,
  height,
  selectedIds = [],
  onImageClick,
}: ImageLayerProps) {
  const [loadedImages, setLoadedImages] = useState<Map<string, LoadedImageElement>>(new Map());

  // Load images that haven't been loaded yet
  useEffect(() => {
    const imagesToLoad = images.filter((img) => !loadedImages.has(img.id));

    imagesToLoad.forEach((imgObj) => {
      const img = new Image();
      img.onload = () => {
        setLoadedImages((prev) => {
          const next = new Map(prev);
          next.set(imgObj.id, { id: imgObj.id, element: img });
          return next;
        });
      };
      img.src = imgObj.src;
    });

    // Clean up loaded images that are no longer in the images array
    const currentIds = new Set(images.map((i) => i.id));
    setLoadedImages((prev) => {
      const next = new Map(prev);
      for (const id of prev.keys()) {
        if (!currentIds.has(id)) {
          next.delete(id);
        }
      }
      return next;
    });
  }, [images, loadedImages]);

  // Transform images to screen coordinates
  const renderedImages = useMemo(() => {
    return images.map((imgObj) => {
      const { transform, width: imgWidth, height: imgHeight, opacity = 1 } = imgObj;

      // Get position from transform
      const canvasPos = { x: transform.tx, y: transform.ty };
      const screenPos = canvasToScreen(canvasPos.x, canvasPos.y, camera);

      // Scale dimensions by camera zoom
      const screenWidth = imgWidth * camera.zoom;
      const screenHeight = imgHeight * camera.zoom;

      // Check if image is within viewport (with some padding)
      const padding = 100;
      const isVisible =
        screenPos.x + screenWidth > -padding &&
        screenPos.x < width + padding &&
        screenPos.y + screenHeight > -padding &&
        screenPos.y < height + padding;

      return {
        ...imgObj,
        screenX: screenPos.x,
        screenY: screenPos.y,
        screenWidth,
        screenHeight,
        isVisible,
        opacity,
        isSelected: selectedIds.includes(imgObj.id),
      };
    });
  }, [images, camera, width, height, selectedIds]);

  // Only render visible images
  const visibleImages = renderedImages.filter((img) => img.isVisible);

  if (visibleImages.length === 0) {
    return null;
  }

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {visibleImages.map((img) => {
        const loaded = loadedImages.get(img.id);

        return (
          <g key={img.id}>
            {loaded ? (
              <image
                href={img.src}
                x={img.screenX}
                y={img.screenY}
                width={img.screenWidth}
                height={img.screenHeight}
                opacity={img.opacity}
                preserveAspectRatio="none"
                style={{
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onImageClick?.(img.id, e);
                }}
              />
            ) : (
              // Placeholder while loading
              <rect
                x={img.screenX}
                y={img.screenY}
                width={img.screenWidth}
                height={img.screenHeight}
                fill="#333"
                stroke="#555"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default ImageLayer;
