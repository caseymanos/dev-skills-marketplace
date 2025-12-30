/**
 * SnapGuides Component
 *
 * Renders visual alignment guides when snapping.
 */

import type { CameraState } from '@canvas/contracts';
import type { SnapGuide, SnapConfig } from './types';
import { DEFAULT_SNAP_CONFIG } from './types';
import { canvasToScreen } from '../../events';

export interface SnapGuidesProps {
  /** Active snap guides to display */
  guides: SnapGuide[];
  /** Camera state for coordinate conversion */
  camera: CameraState;
  /** Container dimensions */
  width: number;
  height: number;
  /** Snap configuration */
  config?: Partial<SnapConfig>;
}

export function SnapGuides({
  guides,
  camera,
  width,
  height,
  config: customConfig,
}: SnapGuidesProps) {
  const config = { ...DEFAULT_SNAP_CONFIG, ...customConfig };

  if (!config.showGuides || guides.length === 0) {
    return null;
  }

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {guides.map((guide, index) => {
        if (guide.orientation === 'vertical') {
          // Vertical guide (constant x)
          const screenX = canvasToScreen(guide.position, 0, camera).x;
          const startY = canvasToScreen(0, guide.start, camera).y;
          const endY = canvasToScreen(0, guide.end, camera).y;

          return (
            <g key={index}>
              {/* Main guide line */}
              <line
                x1={screenX}
                y1={Math.min(startY, endY)}
                x2={screenX}
                y2={Math.max(startY, endY)}
                stroke={config.guideColor}
                strokeWidth={config.guideWidth}
                strokeDasharray="4 2"
              />
              {/* Endpoints */}
              <circle
                cx={screenX}
                cy={Math.min(startY, endY)}
                r={3}
                fill={config.guideColor}
              />
              <circle
                cx={screenX}
                cy={Math.max(startY, endY)}
                r={3}
                fill={config.guideColor}
              />
            </g>
          );
        } else {
          // Horizontal guide (constant y)
          const screenY = canvasToScreen(0, guide.position, camera).y;
          const startX = canvasToScreen(guide.start, 0, camera).x;
          const endX = canvasToScreen(guide.end, 0, camera).x;

          return (
            <g key={index}>
              {/* Main guide line */}
              <line
                x1={Math.min(startX, endX)}
                y1={screenY}
                x2={Math.max(startX, endX)}
                y2={screenY}
                stroke={config.guideColor}
                strokeWidth={config.guideWidth}
                strokeDasharray="4 2"
              />
              {/* Endpoints */}
              <circle
                cx={Math.min(startX, endX)}
                cy={screenY}
                r={3}
                fill={config.guideColor}
              />
              <circle
                cx={Math.max(startX, endX)}
                cy={screenY}
                r={3}
                fill={config.guideColor}
              />
            </g>
          );
        }
      })}
    </svg>
  );
}

export default SnapGuides;
