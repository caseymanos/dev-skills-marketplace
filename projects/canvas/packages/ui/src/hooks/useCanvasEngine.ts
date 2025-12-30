/**
 * useCanvasEngine Hook
 *
 * React hook for initializing and managing the WASM canvas engine.
 * Handles engine lifecycle and provides a stable reference.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  CanvasEngine,
  InitOptions,
  CanvasCallbacks,
  InputEvent,
  CameraState,
} from '@canvas/contracts';

interface CanvasEngineState {
  engine: CanvasEngine | null;
  isLoading: boolean;
  error: Error | null;
  camera: CameraState;
}

interface UseCanvasEngineOptions extends InitOptions {
  /** Callbacks from engine to UI */
  callbacks?: CanvasCallbacks;
}

/**
 * Hook to manage the WASM canvas engine lifecycle
 *
 * @param canvasRef - Ref to the canvas element
 * @param options - Engine initialization options
 */
export function useCanvasEngine(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  options: UseCanvasEngineOptions = {}
): CanvasEngineState & {
  handleEvent: (event: InputEvent) => boolean;
  getCamera: () => CameraState;
} {
  const { callbacks } = options;
  const engineRef = useRef<CanvasEngine | null>(null);

  const [state, setState] = useState<CanvasEngineState>({
    engine: null,
    isLoading: true,
    error: null,
    camera: { x: 0, y: 0, zoom: 1 },
  });

  // Handle events - forwards to engine
  const handleEvent = useCallback((event: InputEvent): boolean => {
    if (!engineRef.current) return false;
    return engineRef.current.handleEvent(event);
  }, []);

  // Get current camera state
  const getCamera = useCallback((): CameraState => {
    if (!engineRef.current) return state.camera;
    return engineRef.current.getCamera();
  }, [state.camera]);

  // Initialize engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let mounted = true;

    async function initEngine() {
      try {
        // TODO: Import actual WASM module when agent-core provides it
        // For now, we create a mock engine for testing the UI layer
        const mockEngine = createMockEngine(canvas!, callbacks);

        if (!mounted) return;

        engineRef.current = mockEngine;
        setState({
          engine: mockEngine,
          isLoading: false,
          error: null,
          camera: mockEngine.getCamera(),
        });
      } catch (err) {
        if (!mounted) return;
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err : new Error('Failed to init engine'),
        }));
      }
    }

    initEngine();

    return () => {
      mounted = false;
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, [canvasRef]);

  // Set up camera change callback
  useEffect(() => {
    if (!callbacks?.onCameraChange) return;

    // Subscribe to camera changes if engine supports it
    // For now, camera changes are tracked via state
  }, [callbacks?.onCameraChange]);

  return {
    ...state,
    handleEvent,
    getCamera,
  };
}

/**
 * Create a mock engine for testing the UI layer
 * This will be replaced by the actual WASM engine from agent-core
 */
function createMockEngine(
  _canvas: HTMLCanvasElement,
  callbacks?: CanvasCallbacks
): CanvasEngine {
  let camera: CameraState = { x: 0, y: 0, zoom: 1 };
  let currentTool: import('@canvas/contracts').ToolType = 'select';
  const objects = new Map<string, import('@canvas/contracts').CanvasObject>();
  let selectedIds: string[] = [];

  return {
    async init() {
      // Mock initialization
    },

    destroy() {
      // Mock cleanup
    },

    resize(_width: number, _height: number) {
      // Mock resize
    },

    render() {
      return {
        frameTime: 16,
        drawCalls: 0,
        objectsRendered: objects.size,
        objectsCulled: 0,
      };
    },

    requestRender() {
      // Mock request render
    },

    handleEvent(event) {
      // Mock event handling - return true if event was consumed
      if (event.type === 'wheel') {
        // Handle zoom with Ctrl+wheel
        const wheelEvent = event as import('@canvas/contracts').WheelEvent;
        if (wheelEvent.modifiers.ctrl || wheelEvent.modifiers.meta) {
          const zoomFactor = wheelEvent.deltaY > 0 ? 0.9 : 1.1;
          camera = {
            ...camera,
            zoom: Math.max(0.1, Math.min(10, camera.zoom * zoomFactor)),
          };
          callbacks?.onCameraChange?.(camera);
          return true;
        }

        // Handle pan with wheel
        camera = {
          ...camera,
          x: camera.x + wheelEvent.deltaX / camera.zoom,
          y: camera.y + wheelEvent.deltaY / camera.zoom,
        };
        callbacks?.onCameraChange?.(camera);
        return true;
      }

      return false;
    },

    setTool(tool) {
      currentTool = tool;
      callbacks?.onToolChange?.(tool);
    },

    getTool() {
      return currentTool;
    },

    getCamera() {
      return camera;
    },

    setCamera(newCamera) {
      camera = newCamera;
      callbacks?.onCameraChange?.(camera);
    },

    panBy(dx, dy) {
      camera = { ...camera, x: camera.x + dx, y: camera.y + dy };
      callbacks?.onCameraChange?.(camera);
    },

    zoomTo(zoom, centerX, centerY) {
      camera = {
        x: centerX - (centerX - camera.x) * (zoom / camera.zoom),
        y: centerY - (centerY - camera.y) * (zoom / camera.zoom),
        zoom,
      };
      callbacks?.onCameraChange?.(camera);
    },

    fitToContent() {
      camera = { x: 0, y: 0, zoom: 1 };
      callbacks?.onCameraChange?.(camera);
    },

    screenToCanvas(screenX, screenY) {
      return {
        x: screenX / camera.zoom + camera.x,
        y: screenY / camera.zoom + camera.y,
      };
    },

    canvasToScreen(canvasX, canvasY) {
      return {
        x: (canvasX - camera.x) * camera.zoom,
        y: (canvasY - camera.y) * camera.zoom,
      };
    },

    createObject(obj) {
      const id = `obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const fullObj = { ...obj, id } as import('@canvas/contracts').CanvasObject;
      objects.set(id, fullObj);
      callbacks?.onObjectCreated?.(fullObj);
      return id;
    },

    updateObject(id, updates) {
      const obj = objects.get(id);
      if (obj) {
        Object.assign(obj, updates);
        callbacks?.onObjectUpdated?.(id, updates);
      }
    },

    deleteObject(id) {
      objects.delete(id);
      callbacks?.onObjectDeleted?.(id);
    },

    getObject(id) {
      return objects.get(id) || null;
    },

    getAllObjects() {
      return Array.from(objects.values());
    },

    getObjectsInBounds(_bounds) {
      // Simplified - return all objects
      return Array.from(objects.values());
    },

    getSelection() {
      return {
        selectedIds,
        bounds: null,
        handles: [],
      };
    },

    setSelection(ids) {
      selectedIds = ids;
      callbacks?.onSelectionChange?.({
        selectedIds,
        bounds: null,
        handles: [],
      });
    },

    addToSelection(ids) {
      selectedIds = [...new Set([...selectedIds, ...ids])];
      callbacks?.onSelectionChange?.({
        selectedIds,
        bounds: null,
        handles: [],
      });
    },

    removeFromSelection(ids) {
      selectedIds = selectedIds.filter((id) => !ids.includes(id));
      callbacks?.onSelectionChange?.({
        selectedIds,
        bounds: null,
        handles: [],
      });
    },

    clearSelection() {
      selectedIds = [];
      callbacks?.onSelectionChange?.({
        selectedIds: [],
        bounds: null,
        handles: [],
      });
    },

    selectAll() {
      selectedIds = Array.from(objects.keys());
      callbacks?.onSelectionChange?.({
        selectedIds,
        bounds: null,
        handles: [],
      });
    },

    undo() {
      return false;
    },

    redo() {
      return false;
    },

    canUndo() {
      return false;
    },

    canRedo() {
      return false;
    },

    getDocumentState() {
      return new Uint8Array();
    },

    applyRemoteChange(_change) {
      // Mock apply remote change
    },

    onLocalChange(_callback) {
      return () => {};
    },

    async exportToPng() {
      return new Blob();
    },

    async exportToSvg() {
      return '';
    },
  };
}

export default useCanvasEngine;
