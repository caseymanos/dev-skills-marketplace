/**
 * useDrawing Hook
 *
 * Manages drawing state for shape creation tools.
 */

import { useState, useCallback, useRef } from 'react';
import type { Point, BoundingBox, ToolType, Color } from '@canvas/contracts';

/**
 * Drawing state
 */
export interface DrawingState {
  /** Whether currently drawing */
  isDrawing: boolean;
  /** Current tool being used */
  tool: ToolType | null;
  /** Start point of draw operation */
  startPoint: Point | null;
  /** Current point during draw */
  currentPoint: Point | null;
  /** Preview bounds */
  previewBounds: BoundingBox | null;
  /** Whether shift is held (constrain proportions) */
  constrained: boolean;
}

/**
 * Drawing options for new shapes
 */
export interface DrawingOptions {
  fillColor: Color | null;
  strokeColor: Color;
  strokeWidth: number;
}

/**
 * Default drawing options
 */
export const DEFAULT_DRAWING_OPTIONS: DrawingOptions = {
  fillColor: { r: 200, g: 200, b: 200, a: 255 },
  strokeColor: { r: 0, g: 0, b: 0, a: 255 },
  strokeWidth: 2,
};

interface UseDrawingOptions {
  /** Callback when shape creation is complete */
  onShapeCreated?: (
    tool: ToolType,
    bounds: BoundingBox,
    options: DrawingOptions
  ) => void;
  /** Drawing options */
  options?: DrawingOptions;
}

interface UseDrawingReturn {
  /** Current drawing state */
  state: DrawingState;
  /** Start drawing at a point */
  startDrawing: (tool: ToolType, point: Point) => void;
  /** Update drawing with new point */
  updateDrawing: (point: Point) => void;
  /** Complete the drawing */
  finishDrawing: () => void;
  /** Cancel current drawing */
  cancelDrawing: () => void;
  /** Set constrained mode (shift key) */
  setConstrained: (constrained: boolean) => void;
  /** Get preview bounds for current draw operation */
  getPreviewBounds: () => BoundingBox | null;
}

/**
 * Calculate bounds from two points
 */
function calculateBounds(
  start: Point,
  end: Point,
  constrained: boolean
): BoundingBox {
  let width = end.x - start.x;
  let height = end.y - start.y;

  // Handle negative dimensions (drawing right-to-left or bottom-to-top)
  const x = width < 0 ? start.x + width : start.x;
  const y = height < 0 ? start.y + height : start.y;
  width = Math.abs(width);
  height = Math.abs(height);

  // Constrain to square/circle if shift held
  if (constrained) {
    const size = Math.max(width, height);
    width = size;
    height = size;
  }

  return { x, y, width, height };
}

/**
 * Hook for managing drawing state
 */
export function useDrawing(options: UseDrawingOptions = {}): UseDrawingReturn {
  const { onShapeCreated, options: drawingOptions = DEFAULT_DRAWING_OPTIONS } = options;

  const [state, setState] = useState<DrawingState>({
    isDrawing: false,
    tool: null,
    startPoint: null,
    currentPoint: null,
    previewBounds: null,
    constrained: false,
  });

  const optionsRef = useRef(drawingOptions);
  optionsRef.current = drawingOptions;

  const startDrawing = useCallback((tool: ToolType, point: Point) => {
    setState({
      isDrawing: true,
      tool,
      startPoint: point,
      currentPoint: point,
      previewBounds: { x: point.x, y: point.y, width: 0, height: 0 },
      constrained: false,
    });
  }, []);

  const updateDrawing = useCallback((point: Point) => {
    setState((prev) => {
      if (!prev.isDrawing || !prev.startPoint) return prev;

      const bounds = calculateBounds(prev.startPoint, point, prev.constrained);

      return {
        ...prev,
        currentPoint: point,
        previewBounds: bounds,
      };
    });
  }, []);

  const finishDrawing = useCallback(() => {
    setState((prev) => {
      if (!prev.isDrawing || !prev.previewBounds || !prev.tool) {
        return {
          isDrawing: false,
          tool: null,
          startPoint: null,
          currentPoint: null,
          previewBounds: null,
          constrained: false,
        };
      }

      // Only create shape if it has some size
      const minSize = 5;
      if (
        prev.previewBounds.width >= minSize ||
        prev.previewBounds.height >= minSize
      ) {
        onShapeCreated?.(prev.tool, prev.previewBounds, optionsRef.current);
      }

      return {
        isDrawing: false,
        tool: null,
        startPoint: null,
        currentPoint: null,
        previewBounds: null,
        constrained: false,
      };
    });
  }, [onShapeCreated]);

  const cancelDrawing = useCallback(() => {
    setState({
      isDrawing: false,
      tool: null,
      startPoint: null,
      currentPoint: null,
      previewBounds: null,
      constrained: false,
    });
  }, []);

  const setConstrained = useCallback((constrained: boolean) => {
    setState((prev) => {
      if (!prev.isDrawing || !prev.startPoint || !prev.currentPoint) {
        return { ...prev, constrained };
      }

      // Recalculate bounds with new constraint
      const bounds = calculateBounds(
        prev.startPoint,
        prev.currentPoint,
        constrained
      );

      return {
        ...prev,
        constrained,
        previewBounds: bounds,
      };
    });
  }, []);

  const getPreviewBounds = useCallback(() => {
    return state.previewBounds;
  }, [state.previewBounds]);

  return {
    state,
    startDrawing,
    updateDrawing,
    finishDrawing,
    cancelDrawing,
    setConstrained,
    getPreviewBounds,
  };
}

export default useDrawing;
