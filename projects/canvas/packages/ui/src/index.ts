/**
 * Canvas UI Package
 *
 * React/TypeScript frontend for the Collaborative Infinite Canvas.
 */

// Components
export {
  Canvas,
  SelectionBox,
  SelectionOverlay,
  Toolbar,
  ToolButton,
  DrawingPreview,
  SnapGuides,
  TOOLS,
  getToolDefinition,
  getToolByShortcut,
  DEFAULT_TOOLBAR_STYLE,
  DEFAULT_SELECTION_STYLE,
  HANDLE_CURSORS,
  DEFAULT_SNAP_CONFIG,
  snapToGrid,
  calculateSnap,
  calculateBoundsSnap,
} from './components';

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
  ToolbarProps,
  ToolButtonProps,
  ToolDefinition,
  ToolbarPosition,
  ToolbarStyle,
  DrawingPreviewProps,
  SnapGuidesProps,
  SnapPoint,
  SnapGuide,
  SnapResult,
  SnapConfig,
  ObjectSnapData,
} from './components';

// Hooks
export {
  useEventManager,
  useCanvasEngine,
  useSelection,
  useDrawing,
  useSnapping,
  DEFAULT_DRAWING_OPTIONS,
} from './hooks';

export type { DrawingState, DrawingOptions } from './hooks';

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
