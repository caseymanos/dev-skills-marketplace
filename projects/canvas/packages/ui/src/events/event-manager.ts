/**
 * Event Manager
 *
 * Central hub for capturing and routing browser events to the WASM engine.
 * Handles pointer, wheel, and keyboard events with proper cleanup.
 */

import type {
  CameraState,
  EventHandler,
  EventManagerOptions,
  Point,
} from './types';

import {
  convertPointerEvent,
  convertWheelEvent,
  convertKeyboardEvent,
  shouldCaptureKeyboardEvent,
} from './event-converter';

import { getPointerPosition, distance } from './coordinate-transform';

const DEFAULT_OPTIONS: Required<EventManagerOptions> = {
  enableGestures: true,
  doubleClickThreshold: 300,
  longPressThreshold: 500,
  dragThreshold: 5,
};

/**
 * Manages event capture and forwarding for the canvas
 */
export class EventManager {
  private canvas: HTMLCanvasElement | null = null;
  private options: Required<EventManagerOptions>;
  private handler: EventHandler | null = null;
  private getCamera: (() => CameraState) | null = null;

  // Pointer tracking
  private activePointers: Map<number, Point> = new Map();
  private lastClickTime: number = 0;
  private lastClickPoint: Point | null = null;
  private longPressTimer: number | null = null;
  private isDragging: boolean = false;
  private dragStartPoint: Point | null = null;

  // Bound event handlers (for cleanup)
  private boundHandlers: {
    pointerdown?: (e: PointerEvent) => void;
    pointermove?: (e: PointerEvent) => void;
    pointerup?: (e: PointerEvent) => void;
    pointercancel?: (e: PointerEvent) => void;
    wheel?: (e: WheelEvent) => void;
    keydown?: (e: KeyboardEvent) => void;
    keyup?: (e: KeyboardEvent) => void;
    contextmenu?: (e: Event) => void;
  } = {};

  constructor(options: EventManagerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Attach event listeners to a canvas element
   */
  attach(
    canvas: HTMLCanvasElement,
    handler: EventHandler,
    getCamera: () => CameraState
  ): void {
    if (this.canvas) {
      this.detach();
    }

    this.canvas = canvas;
    this.handler = handler;
    this.getCamera = getCamera;

    // Create bound handlers
    this.boundHandlers = {
      pointerdown: this.handlePointerDown.bind(this),
      pointermove: this.handlePointerMove.bind(this),
      pointerup: this.handlePointerUp.bind(this),
      pointercancel: this.handlePointerCancel.bind(this),
      wheel: this.handleWheel.bind(this),
      keydown: this.handleKeyDown.bind(this),
      keyup: this.handleKeyUp.bind(this),
      contextmenu: (e: Event) => e.preventDefault(),
    };

    // Attach pointer events to canvas
    canvas.addEventListener('pointerdown', this.boundHandlers.pointerdown!);
    canvas.addEventListener('pointermove', this.boundHandlers.pointermove!);
    canvas.addEventListener('pointerup', this.boundHandlers.pointerup!);
    canvas.addEventListener('pointercancel', this.boundHandlers.pointercancel!);
    canvas.addEventListener('wheel', this.boundHandlers.wheel!, { passive: false });
    canvas.addEventListener('contextmenu', this.boundHandlers.contextmenu!);

    // Attach keyboard events to window (need global capture)
    window.addEventListener('keydown', this.boundHandlers.keydown!);
    window.addEventListener('keyup', this.boundHandlers.keyup!);

    // Set touch-action for better touch handling
    canvas.style.touchAction = 'none';
  }

  /**
   * Detach all event listeners
   */
  detach(): void {
    if (!this.canvas) return;

    const canvas = this.canvas;

    if (this.boundHandlers.pointerdown) {
      canvas.removeEventListener('pointerdown', this.boundHandlers.pointerdown);
    }
    if (this.boundHandlers.pointermove) {
      canvas.removeEventListener('pointermove', this.boundHandlers.pointermove);
    }
    if (this.boundHandlers.pointerup) {
      canvas.removeEventListener('pointerup', this.boundHandlers.pointerup);
    }
    if (this.boundHandlers.pointercancel) {
      canvas.removeEventListener('pointercancel', this.boundHandlers.pointercancel);
    }
    if (this.boundHandlers.wheel) {
      canvas.removeEventListener('wheel', this.boundHandlers.wheel);
    }
    if (this.boundHandlers.contextmenu) {
      canvas.removeEventListener('contextmenu', this.boundHandlers.contextmenu);
    }
    if (this.boundHandlers.keydown) {
      window.removeEventListener('keydown', this.boundHandlers.keydown);
    }
    if (this.boundHandlers.keyup) {
      window.removeEventListener('keyup', this.boundHandlers.keyup);
    }

    this.clearLongPressTimer();
    this.canvas = null;
    this.handler = null;
    this.getCamera = null;
    this.boundHandlers = {};
    this.activePointers.clear();
  }

  /**
   * Handle pointer down events
   */
  private handlePointerDown(event: PointerEvent): void {
    if (!this.canvas || !this.handler || !this.getCamera) return;

    // Capture pointer for drag tracking
    this.canvas.setPointerCapture(event.pointerId);

    const pos = getPointerPosition(event, this.canvas);
    this.activePointers.set(event.pointerId, pos);
    this.dragStartPoint = pos;
    this.isDragging = false;

    // Start long press timer
    if (this.options.enableGestures) {
      this.startLongPressTimer(event);
    }

    // Check for double click (unused for now but ready for gesture support)
    const now = Date.now();
    const timeSinceLastClick = now - this.lastClickTime;
    void (timeSinceLastClick < this.options.doubleClickThreshold &&
      this.lastClickPoint &&
      distance(pos, this.lastClickPoint) < this.options.dragThreshold);

    // Convert and forward to WASM
    const wasmEvent = convertPointerEvent(
      event,
      this.canvas,
      this.getCamera(),
      'pointerdown'
    );

    const consumed = this.handler(wasmEvent);
    if (consumed) {
      event.preventDefault();
    }
  }

  /**
   * Handle pointer move events
   */
  private handlePointerMove(event: PointerEvent): void {
    if (!this.canvas || !this.handler || !this.getCamera) return;

    const pos = getPointerPosition(event, this.canvas);

    // Check if this is a drag
    if (this.dragStartPoint && !this.isDragging) {
      const dist = distance(pos, this.dragStartPoint);
      if (dist > this.options.dragThreshold) {
        this.isDragging = true;
        this.clearLongPressTimer();
      }
    }

    // Update tracked position
    if (this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, pos);
    }

    // Convert and forward to WASM
    const wasmEvent = convertPointerEvent(
      event,
      this.canvas,
      this.getCamera(),
      'pointermove'
    );

    const consumed = this.handler(wasmEvent);
    if (consumed) {
      event.preventDefault();
    }
  }

  /**
   * Handle pointer up events
   */
  private handlePointerUp(event: PointerEvent): void {
    if (!this.canvas || !this.handler || !this.getCamera) return;

    // Release pointer capture
    this.canvas.releasePointerCapture(event.pointerId);

    const pos = getPointerPosition(event, this.canvas);
    this.activePointers.delete(event.pointerId);
    this.clearLongPressTimer();

    // Track click for double-click detection
    if (!this.isDragging) {
      this.lastClickTime = Date.now();
      this.lastClickPoint = pos;
    }

    // Reset drag state
    this.isDragging = false;
    this.dragStartPoint = null;

    // Convert and forward to WASM
    const wasmEvent = convertPointerEvent(
      event,
      this.canvas,
      this.getCamera(),
      'pointerup'
    );

    const consumed = this.handler(wasmEvent);
    if (consumed) {
      event.preventDefault();
    }
  }

  /**
   * Handle pointer cancel events
   */
  private handlePointerCancel(event: PointerEvent): void {
    this.activePointers.delete(event.pointerId);
    this.clearLongPressTimer();
    this.isDragging = false;
    this.dragStartPoint = null;
  }

  /**
   * Handle wheel events
   */
  private handleWheel(event: WheelEvent): void {
    if (!this.canvas || !this.handler || !this.getCamera) return;

    // Always prevent default for wheel on canvas (prevents page scroll)
    event.preventDefault();

    // Convert and forward to WASM
    const wasmEvent = convertWheelEvent(event, this.canvas, this.getCamera());
    this.handler(wasmEvent);
  }

  /**
   * Handle key down events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.handler) return;

    // Check if we should capture this event
    if (!shouldCaptureKeyboardEvent(event)) return;

    // Convert and forward to WASM
    const wasmEvent = convertKeyboardEvent(event, 'keydown');
    const consumed = this.handler(wasmEvent);

    if (consumed) {
      event.preventDefault();
    }
  }

  /**
   * Handle key up events
   */
  private handleKeyUp(event: KeyboardEvent): void {
    if (!this.handler) return;

    // Check if we should capture this event
    if (!shouldCaptureKeyboardEvent(event)) return;

    // Convert and forward to WASM
    const wasmEvent = convertKeyboardEvent(event, 'keyup');
    const consumed = this.handler(wasmEvent);

    if (consumed) {
      event.preventDefault();
    }
  }

  /**
   * Start long press timer
   */
  private startLongPressTimer(_event: PointerEvent): void {
    this.clearLongPressTimer();
    this.longPressTimer = window.setTimeout(() => {
      // Long press detected - could emit a gesture event here
      this.longPressTimer = null;
    }, this.options.longPressThreshold);
  }

  /**
   * Clear long press timer
   */
  private clearLongPressTimer(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  /**
   * Get number of active pointers (for multi-touch detection)
   */
  getActivePointerCount(): number {
    return this.activePointers.size;
  }

  /**
   * Check if currently dragging
   */
  getIsDragging(): boolean {
    return this.isDragging;
  }
}

/**
 * Create a new EventManager instance
 */
export function createEventManager(
  options?: EventManagerOptions
): EventManager {
  return new EventManager(options);
}
