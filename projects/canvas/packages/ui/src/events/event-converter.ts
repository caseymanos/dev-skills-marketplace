/**
 * Event Converter
 *
 * Converts browser DOM events to WASM-compatible InputEvent types.
 * This is the bridge between the browser event system and the Rust engine.
 */

import type {
  PointerEvent as WasmPointerEvent,
  WheelEvent as WasmWheelEvent,
  KeyboardEvent as WasmKeyboardEvent,
  InputEvent,
  Modifiers,
  CameraState,
  Point,
} from './types';

import { screenToCanvas, getPointerPosition } from './coordinate-transform';

/**
 * Extract modifier keys from a browser event
 */
export function extractModifiers(
  event: KeyboardEvent | MouseEvent | PointerEvent | WheelEvent
): Modifiers {
  return {
    shift: event.shiftKey,
    ctrl: event.ctrlKey,
    alt: event.altKey,
    meta: event.metaKey,
  };
}

/**
 * Map browser button number to our button type
 */
function mapPointerButton(button: number): 'left' | 'middle' | 'right' {
  switch (button) {
    case 0:
      return 'left';
    case 1:
      return 'middle';
    case 2:
      return 'right';
    default:
      return 'left';
  }
}

/**
 * Convert browser PointerEvent to WASM PointerEvent
 */
export function convertPointerEvent(
  event: PointerEvent,
  canvas: HTMLCanvasElement,
  camera: CameraState,
  type: 'pointerdown' | 'pointermove' | 'pointerup'
): WasmPointerEvent {
  const screenPos = getPointerPosition(event, canvas);
  const canvasPos = screenToCanvas(screenPos.x, screenPos.y, camera);

  return {
    type,
    canvasX: canvasPos.x,
    canvasY: canvasPos.y,
    screenX: screenPos.x,
    screenY: screenPos.y,
    button: mapPointerButton(event.button),
    buttons: event.buttons,
    modifiers: extractModifiers(event),
    pressure: event.pressure,
    pointerId: event.pointerId,
  };
}

/**
 * Convert browser WheelEvent to WASM WheelEvent
 */
export function convertWheelEvent(
  event: WheelEvent,
  canvas: HTMLCanvasElement,
  camera: CameraState
): WasmWheelEvent {
  const screenPos = getPointerPosition(event, canvas);
  const canvasPos = screenToCanvas(screenPos.x, screenPos.y, camera);

  // Normalize delta values across browsers
  let deltaX = event.deltaX;
  let deltaY = event.deltaY;
  let deltaZ = event.deltaZ;

  // Handle different delta modes
  if (event.deltaMode === 1) {
    // DOM_DELTA_LINE
    deltaX *= 16;
    deltaY *= 16;
    deltaZ *= 16;
  } else if (event.deltaMode === 2) {
    // DOM_DELTA_PAGE
    deltaX *= window.innerHeight;
    deltaY *= window.innerHeight;
    deltaZ *= window.innerHeight;
  }

  return {
    type: 'wheel',
    canvasX: canvasPos.x,
    canvasY: canvasPos.y,
    deltaX,
    deltaY,
    deltaZ,
    modifiers: extractModifiers(event),
  };
}

/**
 * Convert browser KeyboardEvent to WASM KeyboardEvent
 */
export function convertKeyboardEvent(
  event: KeyboardEvent,
  type: 'keydown' | 'keyup'
): WasmKeyboardEvent {
  return {
    type,
    key: event.key,
    code: event.code,
    modifiers: extractModifiers(event),
  };
}

/**
 * Check if an event should be passed to the canvas engine
 *
 * Some keyboard events (like browser shortcuts) should not be captured.
 */
export function shouldCaptureKeyboardEvent(event: KeyboardEvent): boolean {
  // Don't capture if focused on an input element
  const target = event.target as HTMLElement;
  if (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  ) {
    return false;
  }

  // Allow browser refresh (Cmd/Ctrl + R)
  if ((event.metaKey || event.ctrlKey) && event.key === 'r') {
    return false;
  }

  // Allow dev tools (F12, Cmd/Ctrl + Shift + I)
  if (event.key === 'F12') {
    return false;
  }
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'i') {
    return false;
  }

  return true;
}

/**
 * Check if a pointer event is from a touch device
 */
export function isTouchEvent(event: PointerEvent): boolean {
  return event.pointerType === 'touch';
}

/**
 * Check if a pointer event is from a pen/stylus
 */
export function isPenEvent(event: PointerEvent): boolean {
  return event.pointerType === 'pen';
}
