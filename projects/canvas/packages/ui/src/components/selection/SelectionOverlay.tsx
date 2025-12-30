/**
 * SelectionOverlay Component
 *
 * SVG overlay for selection box and handles.
 * Positioned absolutely over the canvas.
 */

import { useCallback, useEffect } from 'react';
import type { BoundingBox, CameraState } from '@canvas/contracts';
import type { Handle, HandleType } from './types';
import { SelectionBox } from './SelectionBox';
import { canvasToScreen } from '../../events';

export interface SelectionOverlayProps {
  /** Selection bounds in canvas coordinates */
  bounds: BoundingBox | null;
  /** Rotation in radians */
  rotation: number;
  /** Transform handles */
  handles: Handle[];
  /** Camera state for coordinate conversion */
  camera: CameraState;
  /** Container dimensions */
  width: number;
  height: number;
  /** Whether currently transforming */
  isTransforming?: boolean;
  /** Active handle being dragged */
  activeHandle?: HandleType | null;
  /** Called when pointer down on handle */
  onHandlePointerDown?: (handle: HandleType, event: React.PointerEvent) => void;
  /** Called when pointer down on selection box (for move) */
  onBoxPointerDown?: (event: React.PointerEvent) => void;
}

/**
 * Convert canvas bounds to screen bounds
 */
function boundsToScreen(bounds: BoundingBox, camera: CameraState): BoundingBox {
  const topLeft = canvasToScreen(bounds.x, bounds.y, camera);
  const bottomRight = canvasToScreen(
    bounds.x + bounds.width,
    bounds.y + bounds.height,
    camera
  );

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}

/**
 * Convert canvas handles to screen handles
 */
function handlesToScreen(handles: Handle[], camera: CameraState): Handle[] {
  return handles.map((handle) => ({
    ...handle,
    position: canvasToScreen(handle.position.x, handle.position.y, camera),
  }));
}

/**
 * Overlay for rendering selection UI
 */
export function SelectionOverlay({
  bounds,
  rotation,
  handles,
  camera,
  width,
  height,
  isTransforming = false,
  activeHandle,
  onHandlePointerDown,
  onBoxPointerDown,
}: SelectionOverlayProps) {
  if (!bounds) return null;

  // Convert to screen coordinates
  const screenBounds = boundsToScreen(bounds, camera);
  const screenHandles = handlesToScreen(handles, camera);

  // Handle pointer events on handles
  const handlePointerDown = useCallback(
    (handleType: HandleType) => (event: React.PointerEvent) => {
      event.stopPropagation();
      event.preventDefault();
      onHandlePointerDown?.(handleType, event);
    },
    [onHandlePointerDown]
  );

  // Handle pointer events on box
  const boxPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.stopPropagation();
      event.preventDefault();
      onBoxPointerDown?.(event);
    },
    [onBoxPointerDown]
  );

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {/* Invisible hit area for the selection box (for move) */}
      <rect
        x={screenBounds.x}
        y={screenBounds.y}
        width={screenBounds.width}
        height={screenBounds.height}
        fill="transparent"
        style={{ pointerEvents: 'all', cursor: 'move' }}
        onPointerDown={boxPointerDown}
      />

      {/* Visual selection box */}
      <SelectionBox
        bounds={screenBounds}
        rotation={rotation}
        handles={screenHandles}
        activeHandle={activeHandle}
        isTransforming={isTransforming}
        zoom={camera.zoom}
      />

      {/* Invisible hit areas for handles (larger than visual) */}
      {screenHandles.map((handle) => {
        const hitSize = 16; // Larger hit area
        const halfHit = hitSize / 2;

        return (
          <rect
            key={handle.type}
            x={handle.position.x - halfHit}
            y={handle.position.y - halfHit}
            width={hitSize}
            height={hitSize}
            fill="transparent"
            style={{ pointerEvents: 'all', cursor: handle.cursor }}
            onPointerDown={handlePointerDown(handle.type)}
          />
        );
      })}
    </svg>
  );
}

export default SelectionOverlay;
