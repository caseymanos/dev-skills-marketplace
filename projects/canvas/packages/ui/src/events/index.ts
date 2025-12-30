/**
 * Event System
 *
 * Handles browser event capture and conversion to WASM-compatible events.
 * This module bridges the gap between DOM events and the Rust canvas engine.
 */

// Types
export type {
  InputEvent,
  Point,
  Modifiers,
  CameraState,
  EventHandler,
  GestureType,
  GestureState,
  EventManagerOptions,
} from './types';

// Coordinate transformation
export {
  screenToCanvas,
  canvasToScreen,
  getPointerPosition,
  zoomAtPoint,
  clampZoom,
  distance,
  angle,
  midpoint,
} from './coordinate-transform';

// Event conversion
export {
  extractModifiers,
  convertPointerEvent,
  convertWheelEvent,
  convertKeyboardEvent,
  shouldCaptureKeyboardEvent,
  isTouchEvent,
  isPenEvent,
} from './event-converter';

// Event manager
export { EventManager, createEventManager } from './event-manager';
