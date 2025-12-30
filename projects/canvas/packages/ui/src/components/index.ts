/**
 * Components
 *
 * React components for the canvas UI.
 */

export { Canvas } from './Canvas';
export type { CanvasProps } from './Canvas';

// Selection components
export {
  SelectionBox,
  SelectionOverlay,
  DEFAULT_SELECTION_STYLE,
  HANDLE_CURSORS,
} from './selection';

export type {
  HandleType,
  Handle,
  TransformOperation,
  SelectionState,
  TransformState,
  SelectionStyle,
  SelectionBoxProps,
  SelectionOverlayProps,
} from './selection';

// Toolbar components
export {
  Toolbar,
  ToolButton,
  HistoryButtons,
  TOOLS,
  getToolDefinition,
  getToolByShortcut,
  DEFAULT_TOOLBAR_STYLE,
} from './toolbar';

export type {
  ToolbarProps,
  ToolButtonProps,
  HistoryButtonsProps,
  ToolDefinition,
  ToolbarPosition,
  ToolbarStyle,
} from './toolbar';

// Drawing components
export { DrawingPreview } from './drawing';
export type { DrawingPreviewProps } from './drawing';

// Snapping components
export {
  SnapGuides,
  getSnapPointsFromBounds,
  getDragSnapPoints,
  snapToGrid,
  calculateSnap,
  calculateBoundsSnap,
  DEFAULT_SNAP_CONFIG,
} from './snapping';

export type {
  SnapGuidesProps,
  GuideOrientation,
  SnapPointType,
  SnapPoint,
  SnapGuide,
  SnapResult,
  SnapConfig,
  ObjectSnapData,
} from './snapping';

// Media components
export {
  ImageLayer,
  ImageDropZone,
  calculateFitDimensions,
  boundsToCenter,
  SUPPORTED_IMAGE_TYPES,
  DEFAULT_MAX_IMAGE_SIZE,
} from './media';

export type {
  ImageFormat,
  ImageLoadState,
  LoadedImage,
  ImageUploadResult,
  DropZoneState,
  ImagePlacementOptions,
} from './media';
