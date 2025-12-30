/**
 * Snapping Components
 */

export { SnapGuides } from './SnapGuides';
export type { SnapGuidesProps } from './SnapGuides';

export {
  getSnapPointsFromBounds,
  getDragSnapPoints,
  snapToGrid,
  calculateSnap,
  calculateBoundsSnap,
} from './snap-utils';

export { DEFAULT_SNAP_CONFIG } from './types';

export type {
  GuideOrientation,
  SnapPointType,
  SnapPoint,
  SnapGuide,
  SnapResult,
  SnapConfig,
  ObjectSnapData,
} from './types';
