/**
 * Selection Components
 *
 * Components and utilities for selection and transformation.
 */

// Types
export type {
  HandleType,
  Handle,
  TransformOperation,
  SelectionState,
  TransformState,
  SelectionStyle,
} from './types';

export { DEFAULT_SELECTION_STYLE, HANDLE_CURSORS } from './types';

// Utilities
export {
  calculateHandles,
  hitTestHandle,
  hitTestBounds,
  calculateResizeBounds,
  calculateMoveBounds,
  calculateRotation,
  normalizeAngle,
  radToDeg,
  degToRad,
  rotatePoint,
  getBoundsCenter,
} from './transform-utils';

// Components
export { SelectionBox } from './SelectionBox';
export type { SelectionBoxProps } from './SelectionBox';

export { SelectionOverlay } from './SelectionOverlay';
export type { SelectionOverlayProps } from './SelectionOverlay';
