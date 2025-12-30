/**
 * Coordinate Transformation
 *
 * Handles conversion between screen (DOM) coordinates and canvas coordinates.
 * Uses the camera state (pan + zoom) to transform points.
 */

import type { Point, CameraState } from './types';

/**
 * Transform screen coordinates to canvas coordinates
 *
 * Screen coords are relative to the canvas element's bounding rect.
 * Canvas coords are in the infinite canvas space.
 *
 * Formula:
 *   canvasX = (screenX / zoom) + cameraX
 *   canvasY = (screenY / zoom) + cameraY
 */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  camera: CameraState
): Point {
  return {
    x: screenX / camera.zoom + camera.x,
    y: screenY / camera.zoom + camera.y,
  };
}

/**
 * Transform canvas coordinates to screen coordinates
 *
 * Formula:
 *   screenX = (canvasX - cameraX) * zoom
 *   screenY = (canvasY - cameraY) * zoom
 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  camera: CameraState
): Point {
  return {
    x: (canvasX - camera.x) * camera.zoom,
    y: (canvasY - camera.y) * camera.zoom,
  };
}

/**
 * Get pointer position relative to a canvas element
 *
 * Accounts for element offset and scroll position.
 */
export function getPointerPosition(
  event: PointerEvent | MouseEvent | WheelEvent,
  canvas: HTMLCanvasElement
): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

/**
 * Calculate zoom at a specific point
 *
 * Zooms toward/away from the given screen point, keeping that point
 * stationary on screen.
 */
export function zoomAtPoint(
  screenX: number,
  screenY: number,
  newZoom: number,
  camera: CameraState
): CameraState {
  // Point in canvas space before zoom
  const canvasPoint = screenToCanvas(screenX, screenY, camera);

  // After zoom, we want the same canvas point to be at the same screen position
  // newScreenX = (canvasX - newCameraX) * newZoom
  // screenX = (canvasX - newCameraX) * newZoom
  // newCameraX = canvasX - (screenX / newZoom)

  return {
    x: canvasPoint.x - screenX / newZoom,
    y: canvasPoint.y - screenY / newZoom,
    zoom: newZoom,
  };
}

/**
 * Clamp zoom level to valid range
 */
export function clampZoom(
  zoom: number,
  minZoom: number = 0.1,
  maxZoom: number = 10
): number {
  return Math.max(minZoom, Math.min(maxZoom, zoom));
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate angle between two points (in radians)
 */
export function angle(p1: Point, p2: Point): number {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/**
 * Calculate center point between two points
 */
export function midpoint(p1: Point, p2: Point): Point {
  return {
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2,
  };
}
