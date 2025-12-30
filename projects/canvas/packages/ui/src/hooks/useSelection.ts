/**
 * useSelection Hook
 *
 * Manages selection state and transformation operations.
 */

import { useState, useCallback, useRef } from 'react';
import type { Point, BoundingBox, ObjectId } from '@canvas/contracts';
import type {
  SelectionState,
  TransformState,
  TransformOperation,
  HandleType,
  Handle,
} from '../components/selection/types';
import { DEFAULT_SELECTION_STYLE } from '../components/selection/types';
import {
  calculateHandles,
  hitTestHandle,
  hitTestBounds,
  calculateResizeBounds,
  calculateMoveBounds,
  calculateRotation,
} from '../components/selection/transform-utils';

interface UseSelectionOptions {
  /** Callback when selection changes */
  onSelectionChange?: (ids: ObjectId[]) => void;
  /** Callback when objects are transformed */
  onTransform?: (ids: ObjectId[], bounds: BoundingBox, rotation: number) => void;
  /** Callback when transform operation completes */
  onTransformEnd?: (ids: ObjectId[], bounds: BoundingBox, rotation: number) => void;
}

interface UseSelectionReturn {
  /** Current selection state */
  selection: SelectionState;
  /** Current transform state (during drag) */
  transform: TransformState | null;
  /** Calculated handles for current selection */
  handles: Handle[];
  /** Set selected object IDs */
  setSelection: (ids: ObjectId[], bounds: BoundingBox | null) => void;
  /** Add objects to selection */
  addToSelection: (ids: ObjectId[], bounds: BoundingBox) => void;
  /** Remove objects from selection */
  removeFromSelection: (ids: ObjectId[]) => void;
  /** Clear selection */
  clearSelection: () => void;
  /** Start a transform operation */
  startTransform: (point: Point, handle: HandleType | null) => void;
  /** Update transform during drag */
  updateTransform: (point: Point) => void;
  /** End transform operation */
  endTransform: () => void;
  /** Cancel transform operation */
  cancelTransform: () => void;
  /** Hit test for handles at a point */
  hitTest: (point: Point, zoom: number) => { handle: Handle | null; inBounds: boolean };
  /** Set aspect lock state */
  setAspectLocked: (locked: boolean) => void;
  /** Get cursor for current state */
  getCursor: (point: Point, zoom: number) => string;
}

/**
 * Hook for managing selection and transformation
 */
export function useSelection(options: UseSelectionOptions = {}): UseSelectionReturn {
  const { onSelectionChange, onTransform, onTransformEnd } = options;

  const [selection, setSelectionState] = useState<SelectionState>({
    selectedIds: [],
    bounds: null,
    rotation: 0,
    aspectLocked: false,
  });

  const [transform, setTransform] = useState<TransformState | null>(null);

  // Track original state for cancel
  const originalStateRef = useRef<{
    bounds: BoundingBox | null;
    rotation: number;
  } | null>(null);

  // Calculate handles
  const handles = selection.bounds
    ? calculateHandles(
        selection.bounds,
        DEFAULT_SELECTION_STYLE.handleSize,
        DEFAULT_SELECTION_STYLE.rotationHandleDistance
      )
    : [];

  // Set selection
  const setSelection = useCallback(
    (ids: ObjectId[], bounds: BoundingBox | null) => {
      setSelectionState((prev) => ({
        ...prev,
        selectedIds: ids,
        bounds,
        rotation: ids.length === 0 ? 0 : prev.rotation,
      }));
      onSelectionChange?.(ids);
    },
    [onSelectionChange]
  );

  // Add to selection
  const addToSelection = useCallback(
    (ids: ObjectId[], bounds: BoundingBox) => {
      setSelectionState((prev) => {
        const newIds = [...new Set([...prev.selectedIds, ...ids])];
        // Expand bounds to include new selection
        const newBounds = prev.bounds
          ? {
              x: Math.min(prev.bounds.x, bounds.x),
              y: Math.min(prev.bounds.y, bounds.y),
              width:
                Math.max(prev.bounds.x + prev.bounds.width, bounds.x + bounds.width) -
                Math.min(prev.bounds.x, bounds.x),
              height:
                Math.max(prev.bounds.y + prev.bounds.height, bounds.y + bounds.height) -
                Math.min(prev.bounds.y, bounds.y),
            }
          : bounds;

        onSelectionChange?.(newIds);
        return { ...prev, selectedIds: newIds, bounds: newBounds };
      });
    },
    [onSelectionChange]
  );

  // Remove from selection
  const removeFromSelection = useCallback(
    (ids: ObjectId[]) => {
      setSelectionState((prev) => {
        const newIds = prev.selectedIds.filter((id) => !ids.includes(id));
        onSelectionChange?.(newIds);
        return {
          ...prev,
          selectedIds: newIds,
          bounds: newIds.length === 0 ? null : prev.bounds,
        };
      });
    },
    [onSelectionChange]
  );

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectionState({
      selectedIds: [],
      bounds: null,
      rotation: 0,
      aspectLocked: false,
    });
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  // Start transform
  const startTransform = useCallback(
    (point: Point, handle: HandleType | null) => {
      if (!selection.bounds) return;

      // Store original state for cancel
      originalStateRef.current = {
        bounds: { ...selection.bounds },
        rotation: selection.rotation,
      };

      const operation: TransformOperation =
        handle === null
          ? 'move'
          : handle === 'rotation'
          ? 'rotate'
          : (`resize-${handle}` as TransformOperation);

      setTransform({
        operation,
        startPoint: point,
        currentPoint: point,
        originalBounds: { ...selection.bounds },
        originalRotation: selection.rotation,
        activeHandle: handle,
      });
    },
    [selection.bounds, selection.rotation]
  );

  // Update transform
  const updateTransform = useCallback(
    (point: Point) => {
      if (!transform) return;

      const newTransform = { ...transform, currentPoint: point };
      setTransform(newTransform);

      let newBounds: BoundingBox;
      let newRotation = selection.rotation;

      switch (transform.operation) {
        case 'move':
          newBounds = calculateMoveBounds(newTransform);
          break;
        case 'rotate':
          newBounds = transform.originalBounds;
          newRotation = calculateRotation(newTransform, selection.aspectLocked);
          break;
        default:
          // Resize operations
          newBounds = calculateResizeBounds(newTransform, selection.aspectLocked);
          break;
      }

      setSelectionState((prev) => ({
        ...prev,
        bounds: newBounds,
        rotation: newRotation,
      }));

      onTransform?.(selection.selectedIds, newBounds, newRotation);
    },
    [transform, selection.aspectLocked, selection.rotation, selection.selectedIds, onTransform]
  );

  // End transform
  const endTransform = useCallback(() => {
    if (!transform || !selection.bounds) return;

    onTransformEnd?.(selection.selectedIds, selection.bounds, selection.rotation);
    setTransform(null);
    originalStateRef.current = null;
  }, [transform, selection.bounds, selection.rotation, selection.selectedIds, onTransformEnd]);

  // Cancel transform
  const cancelTransform = useCallback(() => {
    if (!transform || !originalStateRef.current) return;

    setSelectionState((prev) => ({
      ...prev,
      bounds: originalStateRef.current!.bounds,
      rotation: originalStateRef.current!.rotation,
    }));
    setTransform(null);
    originalStateRef.current = null;
  }, [transform]);

  // Hit test
  const hitTest = useCallback(
    (point: Point, zoom: number): { handle: Handle | null; inBounds: boolean } => {
      if (!selection.bounds) {
        return { handle: null, inBounds: false };
      }

      // Check handles first (higher priority)
      for (const handle of handles) {
        if (hitTestHandle(point, handle, DEFAULT_SELECTION_STYLE.handleSize, zoom)) {
          return { handle, inBounds: true };
        }
      }

      // Check bounds
      const inBounds = hitTestBounds(point, selection.bounds);
      return { handle: null, inBounds };
    },
    [selection.bounds, handles]
  );

  // Set aspect lock
  const setAspectLocked = useCallback((locked: boolean) => {
    setSelectionState((prev) => ({ ...prev, aspectLocked: locked }));
  }, []);

  // Get cursor
  const getCursor = useCallback(
    (point: Point, zoom: number): string => {
      if (transform) {
        switch (transform.operation) {
          case 'move':
            return 'grabbing';
          case 'rotate':
            return 'grabbing';
          default:
            return transform.activeHandle
              ? handles.find((h) => h.type === transform.activeHandle)?.cursor || 'default'
              : 'default';
        }
      }

      const hit = hitTest(point, zoom);
      if (hit.handle) {
        return hit.handle.cursor;
      }
      if (hit.inBounds) {
        return 'move';
      }
      return 'default';
    },
    [transform, hitTest, handles]
  );

  return {
    selection,
    transform,
    handles,
    setSelection,
    addToSelection,
    removeFromSelection,
    clearSelection,
    startTransform,
    updateTransform,
    endTransform,
    cancelTransform,
    hitTest,
    setAspectLocked,
    getCursor,
  };
}

export default useSelection;
