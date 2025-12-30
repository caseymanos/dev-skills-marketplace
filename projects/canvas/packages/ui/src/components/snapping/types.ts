/**
 * Snapping Types
 *
 * Types for snap points, guides, and alignment.
 */

import type { Point, BoundingBox } from '@canvas/contracts';

/**
 * Snap guide orientation
 */
export type GuideOrientation = 'horizontal' | 'vertical';

/**
 * Types of snap points
 */
export type SnapPointType =
  | 'grid'           // Grid intersection
  | 'object-center'  // Center of another object
  | 'object-edge'    // Edge of another object
  | 'object-corner'  // Corner of another object
  | 'canvas-center'; // Center of visible canvas

/**
 * A point that can be snapped to
 */
export interface SnapPoint {
  x: number;
  y: number;
  type: SnapPointType;
  /** ID of source object (for object snaps) */
  sourceId?: string;
}

/**
 * A visual alignment guide
 */
export interface SnapGuide {
  orientation: GuideOrientation;
  position: number; // x for vertical, y for horizontal
  start: number;    // Start of guide line
  end: number;      // End of guide line
  type: SnapPointType;
}

/**
 * Result of snap calculation
 */
export interface SnapResult {
  /** Snapped position */
  position: Point;
  /** Whether X was snapped */
  snappedX: boolean;
  /** Whether Y was snapped */
  snappedY: boolean;
  /** Guides to display */
  guides: SnapGuide[];
  /** Snap points that matched */
  matchedPoints: SnapPoint[];
}

/**
 * Snapping configuration
 */
export interface SnapConfig {
  /** Enable snapping */
  enabled: boolean;
  /** Snap to grid */
  snapToGrid: boolean;
  /** Grid size in canvas units */
  gridSize: number;
  /** Snap to objects */
  snapToObjects: boolean;
  /** Snap threshold in screen pixels */
  threshold: number;
  /** Show alignment guides */
  showGuides: boolean;
  /** Guide color */
  guideColor: string;
  /** Guide width */
  guideWidth: number;
}

/**
 * Default snap configuration
 */
export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  enabled: true,
  snapToGrid: true,
  gridSize: 10,
  snapToObjects: true,
  threshold: 8,
  showGuides: true,
  guideColor: '#ff6b6b',
  guideWidth: 1,
};

/**
 * Object bounds for snapping calculations
 */
export interface ObjectSnapData {
  id: string;
  bounds: BoundingBox;
}
