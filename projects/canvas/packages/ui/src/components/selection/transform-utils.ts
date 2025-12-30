/**
 * Transform Utilities
 *
 * Math utilities for selection transformations (resize, rotate, move).
 */

import type { Point, BoundingBox } from '@canvas/contracts';
import type { HandleType, Handle, TransformState } from './types';
import { HANDLE_CURSORS } from './types';

/**
 * Calculate handle positions for a bounding box
 */
export function calculateHandles(
  bounds: BoundingBox,
  handleSize: number,
  rotationDistance: number
): Handle[] {
  const { x, y, width, height } = bounds;
  const halfHandle = handleSize / 2;

  // Center points of each edge
  const left = x;
  const right = x + width;
  const top = y;
  const bottom = y + height;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  return [
    // Corner handles
    { type: 'nw' as HandleType, position: { x: left, y: top }, cursor: HANDLE_CURSORS.nw },
    { type: 'ne' as HandleType, position: { x: right, y: top }, cursor: HANDLE_CURSORS.ne },
    { type: 'se' as HandleType, position: { x: right, y: bottom }, cursor: HANDLE_CURSORS.se },
    { type: 'sw' as HandleType, position: { x: left, y: bottom }, cursor: HANDLE_CURSORS.sw },

    // Edge handles
    { type: 'n' as HandleType, position: { x: centerX, y: top }, cursor: HANDLE_CURSORS.n },
    { type: 'e' as HandleType, position: { x: right, y: centerY }, cursor: HANDLE_CURSORS.e },
    { type: 's' as HandleType, position: { x: centerX, y: bottom }, cursor: HANDLE_CURSORS.s },
    { type: 'w' as HandleType, position: { x: left, y: centerY }, cursor: HANDLE_CURSORS.w },

    // Rotation handle (above top-center)
    {
      type: 'rotation' as HandleType,
      position: { x: centerX, y: top - rotationDistance },
      cursor: HANDLE_CURSORS.rotation,
    },
  ];
}

/**
 * Check if a point is within a handle's hit area
 */
export function hitTestHandle(
  point: Point,
  handle: Handle,
  handleSize: number,
  zoom: number
): boolean {
  // Adjust hit area based on zoom (larger hit area when zoomed out)
  const hitSize = Math.max(handleSize, handleSize / zoom) * 1.5;
  const halfHit = hitSize / 2;

  return (
    point.x >= handle.position.x - halfHit &&
    point.x <= handle.position.x + halfHit &&
    point.y >= handle.position.y - halfHit &&
    point.y <= handle.position.y + halfHit
  );
}

/**
 * Check if a point is within the selection bounds (for move)
 */
export function hitTestBounds(point: Point, bounds: BoundingBox): boolean {
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

/**
 * Calculate new bounds after resize operation
 */
export function calculateResizeBounds(
  transform: TransformState,
  aspectLocked: boolean
): BoundingBox {
  const { originalBounds, startPoint, currentPoint, activeHandle } = transform;
  const dx = currentPoint.x - startPoint.x;
  const dy = currentPoint.y - startPoint.y;

  let { x, y, width, height } = originalBounds;
  const aspectRatio = originalBounds.width / originalBounds.height;

  switch (activeHandle) {
    case 'nw':
      x += dx;
      y += dy;
      width -= dx;
      height -= dy;
      if (aspectLocked) {
        const avgDelta = (dx + dy) / 2;
        x = originalBounds.x + avgDelta;
        y = originalBounds.y + avgDelta / aspectRatio;
        width = originalBounds.width - avgDelta;
        height = width / aspectRatio;
      }
      break;

    case 'n':
      y += dy;
      height -= dy;
      if (aspectLocked) {
        width = height * aspectRatio;
        x = originalBounds.x + (originalBounds.width - width) / 2;
      }
      break;

    case 'ne':
      y += dy;
      width += dx;
      height -= dy;
      if (aspectLocked) {
        const avgDelta = (dx - dy) / 2;
        width = originalBounds.width + avgDelta;
        height = width / aspectRatio;
        y = originalBounds.y + originalBounds.height - height;
      }
      break;

    case 'e':
      width += dx;
      if (aspectLocked) {
        height = width / aspectRatio;
        y = originalBounds.y + (originalBounds.height - height) / 2;
      }
      break;

    case 'se':
      width += dx;
      height += dy;
      if (aspectLocked) {
        const avgDelta = (dx + dy) / 2;
        width = originalBounds.width + avgDelta;
        height = width / aspectRatio;
      }
      break;

    case 's':
      height += dy;
      if (aspectLocked) {
        width = height * aspectRatio;
        x = originalBounds.x + (originalBounds.width - width) / 2;
      }
      break;

    case 'sw':
      x += dx;
      width -= dx;
      height += dy;
      if (aspectLocked) {
        const avgDelta = (-dx + dy) / 2;
        width = originalBounds.width + avgDelta;
        height = width / aspectRatio;
        x = originalBounds.x + originalBounds.width - width;
      }
      break;

    case 'w':
      x += dx;
      width -= dx;
      if (aspectLocked) {
        height = width / aspectRatio;
        y = originalBounds.y + (originalBounds.height - height) / 2;
      }
      break;
  }

  // Ensure minimum size
  const minSize = 10;
  if (width < minSize) {
    if (activeHandle?.includes('w')) {
      x = originalBounds.x + originalBounds.width - minSize;
    }
    width = minSize;
  }
  if (height < minSize) {
    if (activeHandle?.includes('n') || activeHandle === 'n') {
      y = originalBounds.y + originalBounds.height - minSize;
    }
    height = minSize;
  }

  return { x, y, width, height };
}

/**
 * Calculate new bounds after move operation
 */
export function calculateMoveBounds(transform: TransformState): BoundingBox {
  const { originalBounds, startPoint, currentPoint } = transform;
  const dx = currentPoint.x - startPoint.x;
  const dy = currentPoint.y - startPoint.y;

  return {
    x: originalBounds.x + dx,
    y: originalBounds.y + dy,
    width: originalBounds.width,
    height: originalBounds.height,
  };
}

/**
 * Calculate rotation angle during rotation operation
 */
export function calculateRotation(
  transform: TransformState,
  snapToAngles: boolean = false
): number {
  const { originalBounds, startPoint, currentPoint, originalRotation } = transform;

  // Center of rotation
  const centerX = originalBounds.x + originalBounds.width / 2;
  const centerY = originalBounds.y + originalBounds.height / 2;

  // Calculate angles from center to start and current points
  const startAngle = Math.atan2(startPoint.y - centerY, startPoint.x - centerX);
  const currentAngle = Math.atan2(currentPoint.y - centerY, currentPoint.x - centerX);

  // Delta angle
  let deltaAngle = currentAngle - startAngle;
  let newRotation = originalRotation + deltaAngle;

  // Snap to 15-degree increments if enabled
  if (snapToAngles) {
    const snapIncrement = Math.PI / 12; // 15 degrees
    newRotation = Math.round(newRotation / snapIncrement) * snapIncrement;
  }

  return newRotation;
}

/**
 * Normalize angle to range [-PI, PI]
 */
export function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= 2 * Math.PI;
  while (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Convert radians to degrees
 */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Convert degrees to radians
 */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Rotate a point around a center point
 */
export function rotatePoint(point: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;

  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

/**
 * Get the center point of a bounding box
 */
export function getBoundsCenter(bounds: BoundingBox): Point {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
}
