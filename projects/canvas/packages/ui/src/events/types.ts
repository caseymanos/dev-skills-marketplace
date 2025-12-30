/**
 * Event System Types
 *
 * Re-exports and extends the contract types for internal use.
 * These types define the event flow from browser to WASM engine.
 */

import type {
  PointerEvent as WasmPointerEvent,
  WheelEvent as WasmWheelEvent,
  KeyboardEvent as WasmKeyboardEvent,
  InputEvent,
  Point,
} from '@canvas/contracts';

// Re-export contract types
export type { InputEvent, Point };
export type { WasmPointerEvent, WasmWheelEvent, WasmKeyboardEvent };

/**
 * Modifiers state shared across all event types
 */
export interface Modifiers {
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

/**
 * Camera state for coordinate transformations
 */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Event handler function type
 */
export type EventHandler<T extends InputEvent = InputEvent> = (event: T) => boolean;

/**
 * Gesture types for complex interactions
 */
export type GestureType =
  | 'tap'
  | 'double-tap'
  | 'long-press'
  | 'drag'
  | 'pinch'
  | 'rotate';

/**
 * Gesture state for tracking multi-touch
 */
export interface GestureState {
  type: GestureType | null;
  startPoint: Point | null;
  currentPoint: Point | null;
  startDistance: number | null;
  startAngle: number | null;
  pointerCount: number;
}

/**
 * Event manager options
 */
export interface EventManagerOptions {
  /** Enable touch gesture support */
  enableGestures?: boolean;
  /** Double-click threshold in ms */
  doubleClickThreshold?: number;
  /** Long press threshold in ms */
  longPressThreshold?: number;
  /** Drag threshold in pixels */
  dragThreshold?: number;
}
