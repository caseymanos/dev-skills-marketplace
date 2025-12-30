/**
 * useSnapping Hook
 *
 * Manages snapping state and configuration.
 */

import { useState, useCallback } from 'react';
import type { Point, BoundingBox } from '@canvas/contracts';
import type {
  SnapConfig,
  SnapResult,
  SnapGuide,
  ObjectSnapData,
} from '../components/snapping/types';
import { DEFAULT_SNAP_CONFIG } from '../components/snapping/types';
import {
  calculateSnap,
  calculateBoundsSnap,
} from '../components/snapping/snap-utils';

interface UseSnappingOptions {
  /** Initial configuration */
  initialConfig?: Partial<SnapConfig>;
}

interface UseSnappingReturn {
  /** Current snap configuration */
  config: SnapConfig;
  /** Active snap guides */
  guides: SnapGuide[];
  /** Update snap configuration */
  setConfig: (config: Partial<SnapConfig>) => void;
  /** Toggle snapping on/off */
  toggleSnapping: () => void;
  /** Toggle grid snapping */
  toggleGridSnap: () => void;
  /** Toggle object snapping */
  toggleObjectSnap: () => void;
  /** Set grid size */
  setGridSize: (size: number) => void;
  /** Snap a point */
  snapPoint: (
    point: Point,
    objects: ObjectSnapData[],
    excludeIds?: string[],
    viewportBounds?: BoundingBox
  ) => SnapResult;
  /** Snap bounds (for moving objects) */
  snapBounds: (
    bounds: BoundingBox,
    objects: ObjectSnapData[],
    excludeIds?: string[],
    viewportBounds?: BoundingBox
  ) => SnapResult;
  /** Clear active guides */
  clearGuides: () => void;
}

/**
 * Hook for managing snapping behavior
 */
export function useSnapping(options: UseSnappingOptions = {}): UseSnappingReturn {
  const { initialConfig } = options;

  const [config, setConfigState] = useState<SnapConfig>({
    ...DEFAULT_SNAP_CONFIG,
    ...initialConfig,
  });

  const [guides, setGuides] = useState<SnapGuide[]>([]);

  const setConfig = useCallback((newConfig: Partial<SnapConfig>) => {
    setConfigState((prev) => ({ ...prev, ...newConfig }));
  }, []);

  const toggleSnapping = useCallback(() => {
    setConfigState((prev) => ({ ...prev, enabled: !prev.enabled }));
    setGuides([]);
  }, []);

  const toggleGridSnap = useCallback(() => {
    setConfigState((prev) => ({ ...prev, snapToGrid: !prev.snapToGrid }));
  }, []);

  const toggleObjectSnap = useCallback(() => {
    setConfigState((prev) => ({ ...prev, snapToObjects: !prev.snapToObjects }));
  }, []);

  const setGridSize = useCallback((size: number) => {
    setConfigState((prev) => ({ ...prev, gridSize: Math.max(1, size) }));
  }, []);

  const snapPoint = useCallback(
    (
      point: Point,
      objects: ObjectSnapData[],
      excludeIds: string[] = [],
      viewportBounds?: BoundingBox
    ): SnapResult => {
      const result = calculateSnap(point, config, objects, excludeIds, viewportBounds);
      setGuides(result.guides);
      return result;
    },
    [config]
  );

  const snapBounds = useCallback(
    (
      bounds: BoundingBox,
      objects: ObjectSnapData[],
      excludeIds: string[] = [],
      viewportBounds?: BoundingBox
    ): SnapResult => {
      const result = calculateBoundsSnap(bounds, config, objects, excludeIds, viewportBounds);
      setGuides(result.guides);
      return result;
    },
    [config]
  );

  const clearGuides = useCallback(() => {
    setGuides([]);
  }, []);

  return {
    config,
    guides,
    setConfig,
    toggleSnapping,
    toggleGridSnap,
    toggleObjectSnap,
    setGridSize,
    snapPoint,
    snapBounds,
    clearGuides,
  };
}

export default useSnapping;
