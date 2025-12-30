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
  TOOLS,
  getToolDefinition,
  getToolByShortcut,
  DEFAULT_TOOLBAR_STYLE,
} from './toolbar';

export type {
  ToolbarProps,
  ToolButtonProps,
  ToolDefinition,
  ToolbarPosition,
  ToolbarStyle,
} from './toolbar';

// Drawing components
export { DrawingPreview } from './drawing';
export type { DrawingPreviewProps } from './drawing';
