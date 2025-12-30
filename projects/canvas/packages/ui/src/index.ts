/**
 * Canvas UI Package
 *
 * React/TypeScript frontend for the Collaborative Infinite Canvas.
 */

// Components
export { Canvas } from './components';
export type { CanvasProps } from './components';

// Hooks
export { useEventManager, useCanvasEngine } from './hooks';

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
