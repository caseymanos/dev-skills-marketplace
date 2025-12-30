/**
 * ImageDropZone Component
 *
 * Overlay component for drag-and-drop image uploads.
 */

import type { DropZoneState } from './types';

interface ImageDropZoneProps {
  /** Drop zone state */
  dropState: DropZoneState;
  /** Canvas dimensions */
  width: number;
  height: number;
}

/**
 * Overlay that appears when dragging images over the canvas
 */
export function ImageDropZone({ dropState, width, height }: ImageDropZoneProps) {
  if (!dropState.isDragOver) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: dropState.isValidDrop
          ? 'rgba(74, 158, 255, 0.15)'
          : 'rgba(255, 107, 107, 0.15)',
        border: `2px dashed ${dropState.isValidDrop ? '#4a9eff' : '#ff6b6b'}`,
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: '16px 24px',
          borderRadius: 8,
          color: 'white',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {dropState.isValidDrop ? 'Drop image to add to canvas' : 'Unsupported file type'}
      </div>
    </div>
  );
}

export default ImageDropZone;
