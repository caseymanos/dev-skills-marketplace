/**
 * Selection Types
 *
 * Types for selection handles and transformation state.
 */

import type { Point, BoundingBox } from '@canvas/contracts';

/**
 * Handle types for selection box
 */
export type HandleType =
  | 'nw'  // northwest (top-left)
  | 'n'   // north (top-center)
  | 'ne'  // northeast (top-right)
  | 'e'   // east (right-center)
  | 'se'  // southeast (bottom-right)
  | 's'   // south (bottom-center)
  | 'sw'  // southwest (bottom-left)
  | 'w'   // west (left-center)
  | 'rotation'; // rotation handle (above top-center)

/**
 * Handle position and metadata
 */
export interface Handle {
  type: HandleType;
  position: Point;
  cursor: string;
}

/**
 * Transform operation being performed
 */
export type TransformOperation =
  | 'none'
  | 'move'
  | 'resize-nw'
  | 'resize-n'
  | 'resize-ne'
  | 'resize-e'
  | 'resize-se'
  | 'resize-s'
  | 'resize-sw'
  | 'resize-w'
  | 'rotate';

/**
 * Selection state
 */
export interface SelectionState {
  /** IDs of selected objects */
  selectedIds: string[];
  /** Bounding box of selection in canvas coordinates */
  bounds: BoundingBox | null;
  /** Current rotation angle in radians */
  rotation: number;
  /** Whether shift key is held (aspect ratio lock) */
  aspectLocked: boolean;
}

/**
 * Transform state during drag operations
 */
export interface TransformState {
  /** Type of transform operation */
  operation: TransformOperation;
  /** Starting point of drag in canvas coordinates */
  startPoint: Point;
  /** Current point of drag in canvas coordinates */
  currentPoint: Point;
  /** Original bounds before transform */
  originalBounds: BoundingBox;
  /** Original rotation before transform */
  originalRotation: number;
  /** Handle being dragged (for resize) */
  activeHandle: HandleType | null;
}

/**
 * Selection box style options
 */
export interface SelectionStyle {
  /** Border color */
  borderColor: string;
  /** Border width */
  borderWidth: number;
  /** Handle size */
  handleSize: number;
  /** Handle fill color */
  handleFill: string;
  /** Handle stroke color */
  handleStroke: string;
  /** Rotation handle distance from top */
  rotationHandleDistance: number;
}

/**
 * Default selection style
 */
export const DEFAULT_SELECTION_STYLE: SelectionStyle = {
  borderColor: '#4a9eff',
  borderWidth: 1,
  handleSize: 8,
  handleFill: '#ffffff',
  handleStroke: '#4a9eff',
  rotationHandleDistance: 24,
};

/**
 * Cursor for each handle type
 */
export const HANDLE_CURSORS: Record<HandleType, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
  rotation: 'grab',
};
