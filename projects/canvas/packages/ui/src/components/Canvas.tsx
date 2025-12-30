/**
 * Canvas Component
 *
 * Main canvas component that integrates the WASM engine with React.
 * Handles rendering, event forwarding, and resize observation.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { useEventManager } from '../hooks/useEventManager';
import { useCanvasEngine } from '../hooks/useCanvasEngine';
import { useSelection } from '../hooks/useSelection';
import { useDrawing } from '../hooks/useDrawing';
import { SelectionOverlay } from './selection';
import { DrawingPreview } from './drawing';
import type { HandleType } from './selection';
import type { CanvasCallbacks, CameraState, ToolType, BoundingBox } from '@canvas/contracts';
import { screenToCanvas } from '../events';

export interface CanvasProps {
  /** CSS class name */
  className?: string;
  /** Inline styles */
  style?: React.CSSProperties;
  /** Callbacks from engine */
  callbacks?: CanvasCallbacks;
  /** Initial camera state */
  initialCamera?: Partial<CameraState>;
  /** Device pixel ratio override */
  devicePixelRatio?: number;
  /** Debug mode */
  debug?: boolean;
  /** Current tool */
  tool?: ToolType;
  /** Called when camera changes */
  onCameraChange?: (camera: CameraState) => void;
}

/**
 * Infinite canvas component with WASM engine integration
 */
export function Canvas({
  className,
  style,
  callbacks,
  initialCamera,
  devicePixelRatio,
  debug = false,
  tool = 'select',
  onCameraChange,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [cursor, setCursor] = useState('default');
  const [currentCamera, setCurrentCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1 });

  // Selection state
  const {
    selection,
    transform,
    handles,
    setSelection,
    clearSelection,
    startTransform,
    updateTransform,
    endTransform,
    setAspectLocked,
  } = useSelection({
    onSelectionChange: (ids) => {
      if (engine) {
        engine.setSelection(ids);
      }
    },
    onTransform: (ids, bounds, rotation) => {
      // Update objects in engine during transform (live preview)
      // This will be implemented when engine supports transform updates
    },
    onTransformEnd: (ids, bounds, rotation) => {
      // Commit transform to engine
      // This will be implemented when engine supports transform commits
    },
  });

  // Drawing state
  const {
    state: drawingState,
    startDrawing,
    updateDrawing,
    finishDrawing,
    cancelDrawing,
    setConstrained: setDrawingConstrained,
  } = useDrawing({
    onShapeCreated: (shapeTool, bounds, options) => {
      if (!engine) return;

      // Create shape based on tool type
      const baseTransform = {
        a: 1, b: 0, c: 0, d: 1,
        tx: bounds.x,
        ty: bounds.y,
      };

      if (shapeTool === 'rectangle') {
        engine.createObject({
          type: 'rectangle',
          transform: baseTransform,
          parentId: null,
          zIndex: 0,
          visible: true,
          locked: false,
          width: bounds.width,
          height: bounds.height,
          fill: options.fillColor,
          stroke: options.strokeColor,
          strokeWidth: options.strokeWidth,
          cornerRadius: 0,
        });
      } else if (shapeTool === 'ellipse') {
        engine.createObject({
          type: 'ellipse',
          transform: baseTransform,
          parentId: null,
          zIndex: 0,
          visible: true,
          locked: false,
          radiusX: bounds.width / 2,
          radiusY: bounds.height / 2,
          fill: options.fillColor,
          stroke: options.strokeColor,
          strokeWidth: options.strokeWidth,
        });
      } else if (shapeTool === 'line') {
        engine.createObject({
          type: 'line',
          transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
          parentId: null,
          zIndex: 0,
          visible: true,
          locked: false,
          startPoint: { x: bounds.x, y: bounds.y },
          endPoint: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
          stroke: options.strokeColor,
          strokeWidth: options.strokeWidth,
        });
      }
    },
  });

  // Merge callbacks with our handlers
  const mergedCallbacks: CanvasCallbacks = {
    ...callbacks,
    onCameraChange: (camera) => {
      callbacks?.onCameraChange?.(camera);
      onCameraChange?.(camera);
      setCurrentCamera(camera);
    },
    onCursorChange: (newCursor) => {
      callbacks?.onCursorChange?.(newCursor);
      setCursor(newCursor);
    },
    onSelectionChange: (selectionState) => {
      callbacks?.onSelectionChange?.(selectionState);
      setSelection(selectionState.selectedIds, selectionState.bounds);
    },
  };

  // Initialize engine
  const { engine, isLoading, error, handleEvent, getCamera } = useCanvasEngine(
    canvasRef,
    {
      callbacks: mergedCallbacks,
      debug,
      devicePixelRatio,
    }
  );

  // Set up event manager
  useEventManager(canvasRef, handleEvent, getCamera, {
    enabled: !isLoading && !error,
    enableGestures: true,
  });

  // Update tool when prop changes
  useEffect(() => {
    if (engine && tool) {
      engine.setTool(tool);
    }
  }, [engine, tool]);

  // Set initial camera
  useEffect(() => {
    if (engine && initialCamera) {
      const current = engine.getCamera();
      engine.setCamera({
        x: initialCamera.x ?? current.x,
        y: initialCamera.y ?? current.y,
        zoom: initialCamera.zoom ?? current.zoom,
      });
    }
  }, [engine, initialCamera]);

  // Handle resize
  const handleResize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const dpr = devicePixelRatio ?? window.devicePixelRatio ?? 1;

    // Update canvas size
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    setDimensions({ width, height });

    // Notify engine of resize
    if (engine) {
      engine.resize(width * dpr, height * dpr);
    }
  }, [engine, devicePixelRatio]);

  // Set up resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      handleResize();
    });

    observer.observe(container);
    handleResize(); // Initial size

    return () => {
      observer.disconnect();
    };
  }, [handleResize]);

  // Render loop
  useEffect(() => {
    if (!engine || isLoading || error) return;

    let running = true;

    function renderLoop() {
      if (!running || !engine) return;

      engine.render();
      rafRef.current = requestAnimationFrame(renderLoop);
    }

    renderLoop();

    return () => {
      running = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [engine, isLoading, error]);

  // Track shift key for aspect lock and drawing constraint
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setAspectLocked(true);
        setDrawingConstrained(true);
      }
      if (e.key === 'Escape') {
        if (transform) {
          endTransform();
          clearSelection();
        }
        if (drawingState.isDrawing) {
          cancelDrawing();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setAspectLocked(false);
        setDrawingConstrained(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [transform, drawingState.isDrawing, setAspectLocked, setDrawingConstrained, endTransform, clearSelection, cancelDrawing]);

  // Check if current tool is a drawing tool
  const isDrawingTool = tool === 'rectangle' || tool === 'ellipse' || tool === 'line';

  // Handle canvas pointer events for drawing
  const handleCanvasPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!canvasRef.current || !isDrawingTool) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const localPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const canvasPos = screenToCanvas(localPos.x, localPos.y, currentCamera);

      startDrawing(tool, canvasPos);
    },
    [isDrawingTool, tool, currentCamera, startDrawing]
  );

  // Global pointer move/up for drawing
  useEffect(() => {
    if (!drawingState.isDrawing) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const localPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const canvasPos = screenToCanvas(localPos.x, localPos.y, currentCamera);

      updateDrawing(canvasPos);
    };

    const handlePointerUp = () => {
      finishDrawing();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [drawingState.isDrawing, currentCamera, updateDrawing, finishDrawing]);

  // Handle selection overlay events
  const handleHandlePointerDown = useCallback(
    (handleType: HandleType, event: React.PointerEvent) => {
      if (!canvasRef.current || !selection.bounds) return;

      const screenPos = { x: event.clientX, y: event.clientY };
      const rect = canvasRef.current.getBoundingClientRect();
      const localPos = { x: screenPos.x - rect.left, y: screenPos.y - rect.top };
      const canvasPos = screenToCanvas(localPos.x, localPos.y, currentCamera);

      startTransform(canvasPos, handleType);
    },
    [selection.bounds, currentCamera, startTransform]
  );

  const handleBoxPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!canvasRef.current || !selection.bounds) return;

      const screenPos = { x: event.clientX, y: event.clientY };
      const rect = canvasRef.current.getBoundingClientRect();
      const localPos = { x: screenPos.x - rect.left, y: screenPos.y - rect.top };
      const canvasPos = screenToCanvas(localPos.x, localPos.y, currentCamera);

      startTransform(canvasPos, null); // null = move operation
    },
    [selection.bounds, currentCamera, startTransform]
  );

  // Global pointer move/up for transform
  useEffect(() => {
    if (!transform) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const localPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const canvasPos = screenToCanvas(localPos.x, localPos.y, currentCamera);

      updateTransform(canvasPos);
    };

    const handlePointerUp = () => {
      endTransform();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [transform, currentCamera, updateTransform, endTransform]);

  // Error state
  if (error) {
    return (
      <div
        className={className}
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1a1a',
          color: '#ff6b6b',
        }}
      >
        Failed to initialize canvas: {error.message}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={isDrawingTool ? handleCanvasPointerDown : undefined}
        style={{
          display: 'block',
          cursor: isDrawingTool ? 'crosshair' : cursor,
          touchAction: 'none',
        }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
          }}
        >
          Loading canvas engine...
        </div>
      )}

      {/* Drawing preview */}
      {drawingState.isDrawing && drawingState.previewBounds && drawingState.tool && (
        <DrawingPreview
          tool={drawingState.tool}
          bounds={drawingState.previewBounds}
          camera={currentCamera}
          width={dimensions.width}
          height={dimensions.height}
        />
      )}

      {/* Selection overlay */}
      {selection.bounds && tool === 'select' && (
        <SelectionOverlay
          bounds={selection.bounds}
          rotation={selection.rotation}
          handles={handles}
          camera={currentCamera}
          width={dimensions.width}
          height={dimensions.height}
          isTransforming={transform !== null}
          activeHandle={transform?.activeHandle}
          onHandlePointerDown={handleHandlePointerDown}
          onBoxPointerDown={handleBoxPointerDown}
        />
      )}

      {/* Debug overlay */}
      {debug && !isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            padding: '4px 8px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            fontSize: 12,
            fontFamily: 'monospace',
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        >
          {dimensions.width}x{dimensions.height} | Tool: {tool}
          {selection.selectedIds.length > 0 && ` | Selected: ${selection.selectedIds.length}`}
        </div>
      )}
    </div>
  );
}

export default Canvas;
