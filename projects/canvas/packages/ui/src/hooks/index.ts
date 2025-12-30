/**
 * React Hooks
 *
 * Custom hooks for canvas functionality.
 */

export { useEventManager } from './useEventManager';
export { useCanvasEngine } from './useCanvasEngine';
export { useSelection } from './useSelection';
export { useDrawing, DEFAULT_DRAWING_OPTIONS } from './useDrawing';
export type { DrawingState, DrawingOptions } from './useDrawing';
export { useSnapping } from './useSnapping';
export { useHistory, createCommand } from './useHistory';
export type { Command, HistoryState } from './useHistory';
export { useKeyboardShortcuts, COMMON_SHORTCUTS } from './useKeyboardShortcuts';
export type { Shortcut } from './useKeyboardShortcuts';
export { useImageUpload } from './useImageUpload';
export { useExport } from './useExport';
export type { ExportFormat, ExportResult, UseExportOptions } from './useExport';

// Optimization hooks
export {
  useStableCallback,
  useDebouncedCallback,
  useThrottledCallback,
  useStabilizedCallback,
} from './useOptimizedCallback';

export { useVirtualization, useChunkedLoading } from './useVirtualization';
export type {
  VirtualItem,
  VirtualizationOptions,
  VirtualizationResult,
} from './useVirtualization';
