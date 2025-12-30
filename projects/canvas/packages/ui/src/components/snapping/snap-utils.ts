/**
 * Snap Utilities
 *
 * Functions for calculating snap points and alignment guides.
 */

import type { Point, BoundingBox } from '@canvas/contracts';
import type {
  SnapPoint,
  SnapGuide,
  SnapResult,
  SnapConfig,
  ObjectSnapData,
} from './types';

/**
 * Get snap points from a bounding box
 */
export function getSnapPointsFromBounds(
  bounds: BoundingBox,
  id?: string
): SnapPoint[] {
  const { x, y, width, height } = bounds;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const right = x + width;
  const bottom = y + height;

  return [
    // Corners
    { x, y, type: 'object-corner', sourceId: id },
    { x: right, y, type: 'object-corner', sourceId: id },
    { x, y: bottom, type: 'object-corner', sourceId: id },
    { x: right, y: bottom, type: 'object-corner', sourceId: id },

    // Edge centers
    { x: centerX, y, type: 'object-edge', sourceId: id },
    { x: right, y: centerY, type: 'object-edge', sourceId: id },
    { x: centerX, y: bottom, type: 'object-edge', sourceId: id },
    { x, y: centerY, type: 'object-edge', sourceId: id },

    // Center
    { x: centerX, y: centerY, type: 'object-center', sourceId: id },
  ];
}

/**
 * Get snap points for dragged bounds
 */
export function getDragSnapPoints(bounds: BoundingBox): Point[] {
  const { x, y, width, height } = bounds;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const right = x + width;
  const bottom = y + height;

  return [
    // Corners
    { x, y },
    { x: right, y },
    { x, y: bottom },
    { x: right, y: bottom },
    // Edge centers
    { x: centerX, y },
    { x: right, y: centerY },
    { x: centerX, y: bottom },
    { x, y: centerY },
    // Center
    { x: centerX, y: centerY },
  ];
}

/**
 * Snap a value to grid
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Find nearest snap point on one axis
 */
function findNearestSnap(
  value: number,
  snapPoints: number[],
  threshold: number
): { snapped: number; distance: number } | null {
  let nearest: { snapped: number; distance: number } | null = null;

  for (const snap of snapPoints) {
    const distance = Math.abs(value - snap);
    if (distance <= threshold && (!nearest || distance < nearest.distance)) {
      nearest = { snapped: snap, distance };
    }
  }

  return nearest;
}

/**
 * Calculate snap result for a point
 */
export function calculateSnap(
  point: Point,
  config: SnapConfig,
  objects: ObjectSnapData[],
  excludeIds: string[] = [],
  viewportBounds?: BoundingBox
): SnapResult {
  const result: SnapResult = {
    position: { ...point },
    snappedX: false,
    snappedY: false,
    guides: [],
    matchedPoints: [],
  };

  if (!config.enabled) return result;

  const threshold = config.threshold;
  const snapPointsX: { value: number; point: SnapPoint }[] = [];
  const snapPointsY: { value: number; point: SnapPoint }[] = [];

  // Collect object snap points
  if (config.snapToObjects) {
    for (const obj of objects) {
      if (excludeIds.includes(obj.id)) continue;

      const points = getSnapPointsFromBounds(obj.bounds, obj.id);
      for (const p of points) {
        snapPointsX.push({ value: p.x, point: p });
        snapPointsY.push({ value: p.y, point: p });
      }
    }
  }

  // Add canvas center snap point
  if (viewportBounds) {
    const centerX = viewportBounds.x + viewportBounds.width / 2;
    const centerY = viewportBounds.y + viewportBounds.height / 2;
    const centerPoint: SnapPoint = { x: centerX, y: centerY, type: 'canvas-center' };
    snapPointsX.push({ value: centerX, point: centerPoint });
    snapPointsY.push({ value: centerY, point: centerPoint });
  }

  // Find nearest X snap
  let nearestX: { value: number; point: SnapPoint; distance: number } | null = null;
  for (const { value, point: snapPoint } of snapPointsX) {
    const distance = Math.abs(point.x - value);
    if (distance <= threshold && (!nearestX || distance < nearestX.distance)) {
      nearestX = { value, point: snapPoint, distance };
    }
  }

  // Find nearest Y snap
  let nearestY: { value: number; point: SnapPoint; distance: number } | null = null;
  for (const { value, point: snapPoint } of snapPointsY) {
    const distance = Math.abs(point.y - value);
    if (distance <= threshold && (!nearestY || distance < nearestY.distance)) {
      nearestY = { value, point: snapPoint, distance };
    }
  }

  // Apply grid snapping if enabled and no object snap found
  if (config.snapToGrid) {
    const gridX = snapToGrid(point.x, config.gridSize);
    const gridY = snapToGrid(point.y, config.gridSize);
    const gridDistX = Math.abs(point.x - gridX);
    const gridDistY = Math.abs(point.y - gridY);

    if (!nearestX && gridDistX <= threshold) {
      result.position.x = gridX;
      result.snappedX = true;
    }
    if (!nearestY && gridDistY <= threshold) {
      result.position.y = gridY;
      result.snappedY = true;
    }
  }

  // Apply object snapping (takes priority over grid)
  if (nearestX) {
    result.position.x = nearestX.value;
    result.snappedX = true;
    result.matchedPoints.push(nearestX.point);

    if (config.showGuides) {
      result.guides.push({
        orientation: 'vertical',
        position: nearestX.value,
        start: Math.min(point.y, nearestX.point.y) - 20,
        end: Math.max(point.y, nearestX.point.y) + 20,
        type: nearestX.point.type,
      });
    }
  }

  if (nearestY) {
    result.position.y = nearestY.value;
    result.snappedY = true;
    result.matchedPoints.push(nearestY.point);

    if (config.showGuides) {
      result.guides.push({
        orientation: 'horizontal',
        position: nearestY.value,
        start: Math.min(point.x, nearestY.point.x) - 20,
        end: Math.max(point.x, nearestY.point.x) + 20,
        type: nearestY.point.type,
      });
    }
  }

  return result;
}

/**
 * Calculate snap result for bounds being moved
 */
export function calculateBoundsSnap(
  bounds: BoundingBox,
  config: SnapConfig,
  objects: ObjectSnapData[],
  excludeIds: string[] = [],
  viewportBounds?: BoundingBox
): SnapResult {
  if (!config.enabled) {
    return {
      position: { x: bounds.x, y: bounds.y },
      snappedX: false,
      snappedY: false,
      guides: [],
      matchedPoints: [],
    };
  }

  const dragPoints = getDragSnapPoints(bounds);
  const threshold = config.threshold;

  // Collect all target snap points
  const targetPointsX: { value: number; point: SnapPoint }[] = [];
  const targetPointsY: { value: number; point: SnapPoint }[] = [];

  if (config.snapToObjects) {
    for (const obj of objects) {
      if (excludeIds.includes(obj.id)) continue;
      const points = getSnapPointsFromBounds(obj.bounds, obj.id);
      for (const p of points) {
        targetPointsX.push({ value: p.x, point: p });
        targetPointsY.push({ value: p.y, point: p });
      }
    }
  }

  if (viewportBounds) {
    const centerX = viewportBounds.x + viewportBounds.width / 2;
    const centerY = viewportBounds.y + viewportBounds.height / 2;
    const centerPoint: SnapPoint = { x: centerX, y: centerY, type: 'canvas-center' };
    targetPointsX.push({ value: centerX, point: centerPoint });
    targetPointsY.push({ value: centerY, point: centerPoint });
  }

  // Find best X snap
  let bestSnapX: { dragX: number; targetX: number; point: SnapPoint; distance: number } | null = null;
  for (const dragPoint of dragPoints) {
    for (const { value, point: targetPoint } of targetPointsX) {
      const distance = Math.abs(dragPoint.x - value);
      if (distance <= threshold && (!bestSnapX || distance < bestSnapX.distance)) {
        bestSnapX = { dragX: dragPoint.x, targetX: value, point: targetPoint, distance };
      }
    }
  }

  // Find best Y snap
  let bestSnapY: { dragY: number; targetY: number; point: SnapPoint; distance: number } | null = null;
  for (const dragPoint of dragPoints) {
    for (const { value, point: targetPoint } of targetPointsY) {
      const distance = Math.abs(dragPoint.y - value);
      if (distance <= threshold && (!bestSnapY || distance < bestSnapY.distance)) {
        bestSnapY = { dragY: dragPoint.y, targetY: value, point: targetPoint, distance };
      }
    }
  }

  const result: SnapResult = {
    position: { x: bounds.x, y: bounds.y },
    snappedX: false,
    snappedY: false,
    guides: [],
    matchedPoints: [],
  };

  // Apply X snap
  if (bestSnapX) {
    const deltaX = bestSnapX.targetX - bestSnapX.dragX;
    result.position.x = bounds.x + deltaX;
    result.snappedX = true;
    result.matchedPoints.push(bestSnapX.point);

    if (config.showGuides) {
      result.guides.push({
        orientation: 'vertical',
        position: bestSnapX.targetX,
        start: Math.min(bounds.y, bestSnapX.point.y) - 20,
        end: Math.max(bounds.y + bounds.height, bestSnapX.point.y) + 20,
        type: bestSnapX.point.type,
      });
    }
  } else if (config.snapToGrid) {
    const gridX = snapToGrid(bounds.x, config.gridSize);
    if (Math.abs(bounds.x - gridX) <= threshold) {
      result.position.x = gridX;
      result.snappedX = true;
    }
  }

  // Apply Y snap
  if (bestSnapY) {
    const deltaY = bestSnapY.targetY - bestSnapY.dragY;
    result.position.y = bounds.y + deltaY;
    result.snappedY = true;
    result.matchedPoints.push(bestSnapY.point);

    if (config.showGuides) {
      result.guides.push({
        orientation: 'horizontal',
        position: bestSnapY.targetY,
        start: Math.min(bounds.x, bestSnapY.point.x) - 20,
        end: Math.max(bounds.x + bounds.width, bestSnapY.point.x) + 20,
        type: bestSnapY.point.type,
      });
    }
  } else if (config.snapToGrid) {
    const gridY = snapToGrid(bounds.y, config.gridSize);
    if (Math.abs(bounds.y - gridY) <= threshold) {
      result.position.y = gridY;
      result.snappedY = true;
    }
  }

  return result;
}
