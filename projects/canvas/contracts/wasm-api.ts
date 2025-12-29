/**
 * WASM API Contract
 *
 * Defines the interface between the Rust/WASM Canvas Engine and the TypeScript UI.
 * All agents must adhere to these signatures.
 *
 * Owner: Shared (agent-core implements, agent-ui consumes)
 * Version: 1.0.0
 */

// =============================================================================
// PRIMITIVE TYPES
// =============================================================================

/** Unique identifier for canvas objects */
export type ObjectId = string;

/** Unique identifier for documents */
export type DocumentId = string;

/** Unique identifier for users */
export type UserId = string;

/** 2D point in canvas coordinates */
export interface Point {
  x: number;
  y: number;
}

/** 2D size */
export interface Size {
  width: number;
  height: number;
}

/** Axis-aligned bounding box */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** RGBA color (0-255 per channel) */
export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** 2D transformation matrix (3x3, row-major, last row implicit [0,0,1]) */
export interface Transform {
  a: number;  // scale x
  b: number;  // skew y
  c: number;  // skew x
  d: number;  // scale y
  tx: number; // translate x
  ty: number; // translate y
}

// =============================================================================
// CANVAS OBJECT TYPES
// =============================================================================

export type ObjectType =
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'polyline'
  | 'path'
  | 'text'
  | 'image'
  | 'group';

export interface BaseObject {
  id: ObjectId;
  type: ObjectType;
  transform: Transform;
  parentId: ObjectId | null;
  zIndex: number;
  visible: boolean;
  locked: boolean;
}

export interface RectangleObject extends BaseObject {
  type: 'rectangle';
  width: number;
  height: number;
  fill: Color | null;
  stroke: Color | null;
  strokeWidth: number;
  cornerRadius: number;
}

export interface EllipseObject extends BaseObject {
  type: 'ellipse';
  radiusX: number;
  radiusY: number;
  fill: Color | null;
  stroke: Color | null;
  strokeWidth: number;
}

export interface LineObject extends BaseObject {
  type: 'line';
  startPoint: Point;
  endPoint: Point;
  stroke: Color;
  strokeWidth: number;
}

export interface TextObject extends BaseObject {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
  fill: Color;
  textAlign: 'left' | 'center' | 'right';
}

export interface GroupObject extends BaseObject {
  type: 'group';
  children: ObjectId[];
}

export type CanvasObject =
  | RectangleObject
  | EllipseObject
  | LineObject
  | TextObject
  | GroupObject;

// =============================================================================
// INPUT EVENTS (UI -> WASM)
// =============================================================================

export type PointerButton = 'left' | 'middle' | 'right';

export interface PointerEvent {
  type: 'pointerdown' | 'pointermove' | 'pointerup';
  canvasX: number;
  canvasY: number;
  screenX: number;
  screenY: number;
  button: PointerButton;
  buttons: number;
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
  pressure: number;
  pointerId: number;
}

export interface WheelEvent {
  type: 'wheel';
  canvasX: number;
  canvasY: number;
  deltaX: number;
  deltaY: number;
  deltaZ: number;
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
}

export interface KeyboardEvent {
  type: 'keydown' | 'keyup';
  key: string;
  code: string;
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
}

export type InputEvent = PointerEvent | WheelEvent | KeyboardEvent;

// =============================================================================
// TOOL TYPES
// =============================================================================

export type ToolType =
  | 'select'
  | 'pan'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'pen'
  | 'text';

// =============================================================================
// CAMERA STATE
// =============================================================================

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

// =============================================================================
// SELECTION STATE
// =============================================================================

export interface SelectionState {
  selectedIds: ObjectId[];
  bounds: BoundingBox | null;
  handles: TransformHandle[];
}

export interface TransformHandle {
  position: Point;
  type: 'corner' | 'edge' | 'rotation';
  cursor: string;
}

// =============================================================================
// RENDER OUTPUT
// =============================================================================

export interface RenderStats {
  frameTime: number;
  drawCalls: number;
  objectsRendered: number;
  objectsCulled: number;
}

// =============================================================================
// WASM MODULE INTERFACE
// =============================================================================

/**
 * Main interface exported by the Rust/WASM module.
 * agent-core implements this, agent-ui consumes it.
 */
export interface CanvasEngine {
  // -------------------------------------------------------------------------
  // LIFECYCLE
  // -------------------------------------------------------------------------

  /**
   * Initialize the canvas engine with a WebGPU/WebGL context.
   * Must be called before any other methods.
   *
   * @param canvas - The HTML canvas element to render to
   * @param options - Initialization options
   * @returns Promise that resolves when initialization is complete
   */
  init(canvas: HTMLCanvasElement, options?: InitOptions): Promise<void>;

  /**
   * Destroy the engine and release all resources.
   */
  destroy(): void;

  /**
   * Resize the canvas. Call when container size changes.
   */
  resize(width: number, height: number): void;

  // -------------------------------------------------------------------------
  // RENDER LOOP
  // -------------------------------------------------------------------------

  /**
   * Render a single frame. Called by requestAnimationFrame loop.
   * @returns Render statistics for debugging/profiling
   */
  render(): RenderStats;

  /**
   * Request a re-render on next frame. Use for non-continuous updates.
   */
  requestRender(): void;

  // -------------------------------------------------------------------------
  // INPUT HANDLING
  // -------------------------------------------------------------------------

  /**
   * Handle an input event from the UI layer.
   * @returns true if the event was consumed, false to let UI handle it
   */
  handleEvent(event: InputEvent): boolean;

  // -------------------------------------------------------------------------
  // TOOL MANAGEMENT
  // -------------------------------------------------------------------------

  /**
   * Set the active tool.
   */
  setTool(tool: ToolType): void;

  /**
   * Get the currently active tool.
   */
  getTool(): ToolType;

  // -------------------------------------------------------------------------
  // CAMERA CONTROL
  // -------------------------------------------------------------------------

  /**
   * Get current camera state.
   */
  getCamera(): CameraState;

  /**
   * Set camera position and zoom.
   */
  setCamera(camera: CameraState): void;

  /**
   * Pan camera by delta.
   */
  panBy(dx: number, dy: number): void;

  /**
   * Zoom to a specific level, centered on a point.
   */
  zoomTo(zoom: number, centerX: number, centerY: number): void;

  /**
   * Fit all objects in view.
   */
  fitToContent(): void;

  // -------------------------------------------------------------------------
  // COORDINATE CONVERSION
  // -------------------------------------------------------------------------

  /**
   * Convert screen coordinates to canvas coordinates.
   */
  screenToCanvas(screenX: number, screenY: number): Point;

  /**
   * Convert canvas coordinates to screen coordinates.
   */
  canvasToScreen(canvasX: number, canvasY: number): Point;

  // -------------------------------------------------------------------------
  // OBJECT OPERATIONS
  // -------------------------------------------------------------------------

  /**
   * Create a new object on the canvas.
   * @returns The ID of the created object
   */
  createObject(object: Omit<CanvasObject, 'id'>): ObjectId;

  /**
   * Update an existing object's properties.
   */
  updateObject(id: ObjectId, updates: Partial<CanvasObject>): void;

  /**
   * Delete an object from the canvas.
   */
  deleteObject(id: ObjectId): void;

  /**
   * Get an object by ID.
   */
  getObject(id: ObjectId): CanvasObject | null;

  /**
   * Get all objects on the canvas.
   */
  getAllObjects(): CanvasObject[];

  /**
   * Get objects within a bounding box.
   */
  getObjectsInBounds(bounds: BoundingBox): CanvasObject[];

  // -------------------------------------------------------------------------
  // SELECTION
  // -------------------------------------------------------------------------

  /**
   * Get current selection state.
   */
  getSelection(): SelectionState;

  /**
   * Set selection to specific objects.
   */
  setSelection(ids: ObjectId[]): void;

  /**
   * Add objects to selection.
   */
  addToSelection(ids: ObjectId[]): void;

  /**
   * Remove objects from selection.
   */
  removeFromSelection(ids: ObjectId[]): void;

  /**
   * Clear selection.
   */
  clearSelection(): void;

  /**
   * Select all objects.
   */
  selectAll(): void;

  // -------------------------------------------------------------------------
  // HISTORY (UNDO/REDO)
  // -------------------------------------------------------------------------

  /**
   * Undo the last action.
   * @returns true if there was an action to undo
   */
  undo(): boolean;

  /**
   * Redo the last undone action.
   * @returns true if there was an action to redo
   */
  redo(): boolean;

  /**
   * Check if undo is available.
   */
  canUndo(): boolean;

  /**
   * Check if redo is available.
   */
  canRedo(): boolean;

  // -------------------------------------------------------------------------
  // DOCUMENT STATE (COLLABORATION)
  // -------------------------------------------------------------------------

  /**
   * Get the current document state as an Automerge-compatible format.
   * Used by agent-sync for synchronization.
   */
  getDocumentState(): Uint8Array;

  /**
   * Apply a remote change from the sync engine.
   * @param change - Automerge change bytes
   */
  applyRemoteChange(change: Uint8Array): void;

  /**
   * Subscribe to local changes for sync.
   * @param callback - Called when local changes occur
   * @returns Unsubscribe function
   */
  onLocalChange(callback: (change: Uint8Array) => void): () => void;

  // -------------------------------------------------------------------------
  // EXPORT
  // -------------------------------------------------------------------------

  /**
   * Export canvas or selection to PNG.
   * @param options - Export options (scale, background, etc.)
   */
  exportToPng(options?: ExportOptions): Promise<Blob>;

  /**
   * Export canvas or selection to SVG.
   */
  exportToSvg(options?: ExportOptions): Promise<string>;
}

// =============================================================================
// INITIALIZATION OPTIONS
// =============================================================================

export interface InitOptions {
  /** Preferred rendering backend */
  preferredBackend?: 'webgpu' | 'webgl2' | 'webgl';

  /** Device pixel ratio override */
  devicePixelRatio?: number;

  /** Background color */
  backgroundColor?: Color;

  /** Enable debug rendering (bounding boxes, etc.) */
  debug?: boolean;

  /** Maximum zoom level */
  maxZoom?: number;

  /** Minimum zoom level */
  minZoom?: number;
}

export interface ExportOptions {
  /** Export only selected objects */
  selectionOnly?: boolean;

  /** Scale factor (default 1) */
  scale?: number;

  /** Include background */
  includeBackground?: boolean;

  /** Padding around content */
  padding?: number;
}

// =============================================================================
// EVENT CALLBACKS (WASM -> UI)
// =============================================================================

/**
 * Callbacks from the engine to the UI layer.
 * agent-ui implements these, agent-core calls them.
 */
export interface CanvasCallbacks {
  /** Called when selection changes */
  onSelectionChange?(selection: SelectionState): void;

  /** Called when camera changes */
  onCameraChange?(camera: CameraState): void;

  /** Called when active tool changes */
  onToolChange?(tool: ToolType): void;

  /** Called when undo/redo availability changes */
  onHistoryChange?(canUndo: boolean, canRedo: boolean): void;

  /** Called when cursor should change */
  onCursorChange?(cursor: string): void;

  /** Called when an object is created */
  onObjectCreated?(object: CanvasObject): void;

  /** Called when an object is updated */
  onObjectUpdated?(id: ObjectId, updates: Partial<CanvasObject>): void;

  /** Called when an object is deleted */
  onObjectDeleted?(id: ObjectId): void;
}
