/**
 * useEventManager Hook
 *
 * React hook for managing canvas event handling.
 * Attaches/detaches event listeners on mount/unmount.
 */

import { useEffect, useRef, useCallback } from 'react';
import {
  EventManager,
  createEventManager,
  type EventHandler,
  type CameraState,
  type EventManagerOptions,
} from '../events';

interface UseEventManagerOptions extends EventManagerOptions {
  /** Whether event handling is enabled */
  enabled?: boolean;
}

/**
 * Hook to manage canvas event handling
 *
 * @param canvasRef - Ref to the canvas element
 * @param handler - Event handler function
 * @param getCamera - Function to get current camera state
 * @param options - Event manager options
 */
export function useEventManager(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  handler: EventHandler,
  getCamera: () => CameraState,
  options: UseEventManagerOptions = {}
): EventManager | null {
  const { enabled = true, ...managerOptions } = options;
  const managerRef = useRef<EventManager | null>(null);

  // Memoize handler to avoid re-attaching on every render
  const stableHandler = useCallback(handler, [handler]);
  const stableGetCamera = useCallback(getCamera, [getCamera]);

  useEffect(() => {
    if (!enabled) {
      if (managerRef.current) {
        managerRef.current.detach();
        managerRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create event manager if needed
    if (!managerRef.current) {
      managerRef.current = createEventManager(managerOptions);
    }

    // Attach to canvas
    managerRef.current.attach(canvas, stableHandler, stableGetCamera);

    // Cleanup on unmount or when deps change
    return () => {
      if (managerRef.current) {
        managerRef.current.detach();
      }
    };
  }, [canvasRef, stableHandler, stableGetCamera, enabled]);

  return managerRef.current;
}

export default useEventManager;
