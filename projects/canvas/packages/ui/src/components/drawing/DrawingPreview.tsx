/**
 * DrawingPreview Component
 *
 * Shows preview of shape being drawn.
 */

import type { BoundingBox, ToolType, CameraState } from '@canvas/contracts';
import { canvasToScreen } from '../../events';

export interface DrawingPreviewProps {
  /** Type of shape being drawn */
  tool: ToolType;
  /** Bounds in canvas coordinates */
  bounds: BoundingBox;
  /** Camera state for coordinate conversion */
  camera: CameraState;
  /** Container dimensions */
  width: number;
  height: number;
  /** Preview style */
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
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

export function DrawingPreview({
  tool,
  bounds,
  camera,
  width,
  height,
  strokeColor = '#4a9eff',
  strokeWidth = 2,
  fillColor = 'rgba(74, 158, 255, 0.1)',
}: DrawingPreviewProps) {
  const screenBounds = boundsToScreen(bounds, camera);
  const scaledStrokeWidth = strokeWidth / camera.zoom;

  // Don't render if too small
  if (screenBounds.width < 1 && screenBounds.height < 1) {
    return null;
  }

  const renderShape = () => {
    switch (tool) {
      case 'rectangle':
        return (
          <rect
            x={screenBounds.x}
            y={screenBounds.y}
            width={screenBounds.width}
            height={screenBounds.height}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={scaledStrokeWidth}
            strokeDasharray={`${4 / camera.zoom} ${4 / camera.zoom}`}
          />
        );

      case 'ellipse':
        const cx = screenBounds.x + screenBounds.width / 2;
        const cy = screenBounds.y + screenBounds.height / 2;
        const rx = screenBounds.width / 2;
        const ry = screenBounds.height / 2;

        return (
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={scaledStrokeWidth}
            strokeDasharray={`${4 / camera.zoom} ${4 / camera.zoom}`}
          />
        );

      case 'line':
        // Line from top-left to bottom-right of bounds
        return (
          <line
            x1={screenBounds.x}
            y1={screenBounds.y}
            x2={screenBounds.x + screenBounds.width}
            y2={screenBounds.y + screenBounds.height}
            stroke={strokeColor}
            strokeWidth={scaledStrokeWidth}
            strokeDasharray={`${4 / camera.zoom} ${4 / camera.zoom}`}
          />
        );

      default:
        return null;
    }
  };

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
      {renderShape()}
    </svg>
  );
}

export default DrawingPreview;
