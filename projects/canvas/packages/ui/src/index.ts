/**
 * Canvas UI Package
 *
 * React/TypeScript frontend for the Collaborative Infinite Canvas.
 */

// Components
export { Canvas, SelectionBox, SelectionOverlay } from './components';
export type {
  CanvasProps,
  SelectionBoxProps,
  SelectionOverlayProps,
  HandleType,
  Handle,
  TransformOperation,
  SelectionState,
  TransformState,
  SelectionStyle,
} from './components';

// Hooks
export { useEventManager, useCanvasEngine, useSelection } from './hooks';

// Events
export {
  EventManager,
  createEventManager,
  screenToCanvas,
  canvasToScreen,
  getPointerPosition,
  zoomAtPoint,
  clampZoom,
} from './events';

export type {
  InputEvent,
  Point,
  Modifiers,
  CameraState,
  EventHandler,
  EventManagerOptions,
} from './events';
