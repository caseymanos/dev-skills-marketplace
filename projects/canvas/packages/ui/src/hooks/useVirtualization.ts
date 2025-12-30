/**
 * useVirtualization Hook
 *
 * Provides viewport-based virtualization for canvas objects.
 */

import { useMemo, useCallback, useState, useEffect } from 'react';
import type { BoundingBox, CameraState } from '@canvas/contracts';

/**
 * Item with bounds for virtualization
 */
export interface VirtualItem {
  id: string;
  bounds: BoundingBox;
}

/**
 * Virtualization options
 */
export interface VirtualizationOptions {
  /** Extra margin around viewport for pre-loading */
  overscan?: number;
  /** Minimum item size for spatial indexing */
  minItemSize?: number;
}

/**
 * Virtualization result
 */
export interface VirtualizationResult<T extends VirtualItem> {
  /** Items visible in the viewport */
  visibleItems: T[];
  /** Total item count */
  totalCount: number;
  /** Number of visible items */
  visibleCount: number;
  /** Check if a specific item is visible */
  isVisible: (id: string) => boolean;
}

/**
 * Simple spatial hash grid for fast lookups
 */
class SpatialHashGrid<T extends VirtualItem> {
  private cellSize: number;
  private grid: Map<string, T[]> = new Map();
  private itemCells: Map<string, string[]> = new Map();

  constructor(cellSize = 200) {
    this.cellSize = cellSize;
  }

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  private getCellsForBounds(bounds: BoundingBox): string[] {
    const cells: string[] = [];
    const startX = Math.floor(bounds.x / this.cellSize);
    const startY = Math.floor(bounds.y / this.cellSize);
    const endX = Math.floor((bounds.x + bounds.width) / this.cellSize);
    const endY = Math.floor((bounds.y + bounds.height) / this.cellSize);

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        cells.push(`${x},${y}`);
      }
    }

    return cells;
  }

  insert(item: T): void {
    const cells = this.getCellsForBounds(item.bounds);
    this.itemCells.set(item.id, cells);

    for (const cell of cells) {
      if (!this.grid.has(cell)) {
        this.grid.set(cell, []);
      }
      this.grid.get(cell)!.push(item);
    }
  }

  remove(id: string): void {
    const cells = this.itemCells.get(id);
    if (!cells) return;

    for (const cell of cells) {
      const items = this.grid.get(cell);
      if (items) {
        const index = items.findIndex((i) => i.id === id);
        if (index !== -1) {
          items.splice(index, 1);
        }
        if (items.length === 0) {
          this.grid.delete(cell);
        }
      }
    }

    this.itemCells.delete(id);
  }

  query(bounds: BoundingBox): T[] {
    const cells = this.getCellsForBounds(bounds);
    const seen = new Set<string>();
    const result: T[] = [];

    for (const cell of cells) {
      const items = this.grid.get(cell);
      if (!items) continue;

      for (const item of items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);

        // Check actual intersection
        if (this.intersects(item.bounds, bounds)) {
          result.push(item);
        }
      }
    }

    return result;
  }

  private intersects(a: BoundingBox, b: BoundingBox): boolean {
    return !(
      a.x + a.width < b.x ||
      b.x + b.width < a.x ||
      a.y + a.height < b.y ||
      b.y + b.height < a.y
    );
  }

  clear(): void {
    this.grid.clear();
    this.itemCells.clear();
  }
}

/**
 * Calculate viewport bounds in canvas coordinates
 */
function getViewportBounds(
  camera: CameraState,
  viewportWidth: number,
  viewportHeight: number,
  overscan: number
): BoundingBox {
  const canvasWidth = viewportWidth / camera.zoom;
  const canvasHeight = viewportHeight / camera.zoom;
  const overscanCanvas = overscan / camera.zoom;

  return {
    x: camera.x - overscanCanvas,
    y: camera.y - overscanCanvas,
    width: canvasWidth + overscanCanvas * 2,
    height: canvasHeight + overscanCanvas * 2,
  };
}

/**
 * Hook for virtualizing canvas objects based on viewport
 */
export function useVirtualization<T extends VirtualItem>(
  items: T[],
  camera: CameraState,
  viewportWidth: number,
  viewportHeight: number,
  options: VirtualizationOptions = {}
): VirtualizationResult<T> {
  const { overscan = 100 } = options;

  // Rebuild spatial index when items change
  const spatialIndex = useMemo(() => {
    const grid = new SpatialHashGrid<T>();
    for (const item of items) {
      grid.insert(item);
    }
    return grid;
  }, [items]);

  // Get viewport bounds
  const viewportBounds = useMemo(
    () => getViewportBounds(camera, viewportWidth, viewportHeight, overscan),
    [camera, viewportWidth, viewportHeight, overscan]
  );

  // Query visible items
  const visibleItems = useMemo(
    () => spatialIndex.query(viewportBounds),
    [spatialIndex, viewportBounds]
  );

  // Create visibility lookup
  const visibleSet = useMemo(
    () => new Set(visibleItems.map((i) => i.id)),
    [visibleItems]
  );

  const isVisible = useCallback(
    (id: string) => visibleSet.has(id),
    [visibleSet]
  );

  return {
    visibleItems,
    totalCount: items.length,
    visibleCount: visibleItems.length,
    isVisible,
  };
}

/**
 * Hook for managing a chunked loading strategy
 */
export function useChunkedLoading<T>(
  items: T[],
  chunkSize = 50,
  loadDelay = 16
): {
  loadedItems: T[];
  isLoading: boolean;
  progress: number;
} {
  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    if (loadedCount >= items.length) return;

    const timer = setTimeout(() => {
      setLoadedCount((prev) => Math.min(prev + chunkSize, items.length));
    }, loadDelay);

    return () => clearTimeout(timer);
  }, [loadedCount, items.length, chunkSize, loadDelay]);

  // Reset when items change
  useEffect(() => {
    setLoadedCount(Math.min(chunkSize, items.length));
  }, [items, chunkSize]);

  return {
    loadedItems: items.slice(0, loadedCount),
    isLoading: loadedCount < items.length,
    progress: items.length > 0 ? loadedCount / items.length : 1,
  };
}

export default useVirtualization;
