/**
 * SelectionBox Component
 *
 * Renders the selection bounding box with transform handles.
 * Overlays on the canvas as an SVG layer.
 */

import type { BoundingBox } from '@canvas/contracts';
import type { Handle, SelectionStyle } from './types';
import { DEFAULT_SELECTION_STYLE } from './types';

export interface SelectionBoxProps {
  /** Bounding box in screen coordinates */
  bounds: BoundingBox;
  /** Rotation angle in radians */
  rotation: number;
  /** Transform handles */
  handles: Handle[];
  /** Active handle being dragged */
  activeHandle?: string | null;
  /** Whether currently transforming */
  isTransforming?: boolean;
  /** Custom style overrides */
  style?: Partial<SelectionStyle>;
  /** Zoom level for scaling handles */
  zoom?: number;
}

/**
 * Render the selection bounding box with handles
 */
export function SelectionBox({
  bounds,
  rotation,
  handles,
  activeHandle,
  isTransforming = false,
  style: customStyle,
  zoom = 1,
}: SelectionBoxProps) {
  const style = { ...DEFAULT_SELECTION_STYLE, ...customStyle };

  // Scale handle size inversely with zoom so they remain consistent size on screen
  const handleSize = style.handleSize / zoom;
  const halfHandle = handleSize / 2;
  const strokeWidth = style.borderWidth / zoom;

  // Center of bounds for rotation transform
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  // Convert rotation to degrees for SVG transform
  const rotationDeg = (rotation * 180) / Math.PI;

  return (
    <g
      transform={`rotate(${rotationDeg} ${centerX} ${centerY})`}
      style={{ pointerEvents: 'none' }}
    >
      {/* Selection rectangle */}
      <rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        fill="none"
        stroke={style.borderColor}
        strokeWidth={strokeWidth}
        strokeDasharray={isTransforming ? `${4 / zoom} ${4 / zoom}` : 'none'}
      />

      {/* Rotation handle line (from top-center to rotation handle) */}
      {handles.find((h) => h.type === 'rotation') && (
        <line
          x1={centerX}
          y1={bounds.y}
          x2={centerX}
          y2={bounds.y - style.rotationHandleDistance / zoom}
          stroke={style.borderColor}
          strokeWidth={strokeWidth}
        />
      )}

      {/* Transform handles */}
      {handles.map((handle) => {
        const isActive = handle.type === activeHandle;
        const isRotation = handle.type === 'rotation';

        return (
          <g key={handle.type}>
            {isRotation ? (
              // Rotation handle (circle)
              <circle
                cx={handle.position.x}
                cy={handle.position.y}
                r={halfHandle}
                fill={isActive ? style.borderColor : style.handleFill}
                stroke={style.handleStroke}
                strokeWidth={strokeWidth}
                style={{ cursor: handle.cursor }}
              />
            ) : (
              // Resize handle (square)
              <rect
                x={handle.position.x - halfHandle}
                y={handle.position.y - halfHandle}
                width={handleSize}
                height={handleSize}
                fill={isActive ? style.borderColor : style.handleFill}
                stroke={style.handleStroke}
                strokeWidth={strokeWidth}
                style={{ cursor: handle.cursor }}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

export default SelectionBox;
