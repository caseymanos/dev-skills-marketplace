/**
 * Canvas Component
 *
 * Main canvas component that integrates the WASM engine with React.
 * Handles rendering, event forwarding, and resize observation.
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { useEventManager } from '../hooks/useEventManager';
import { useCanvasEngine } from '../hooks/useCanvasEngine';
import type { CanvasCallbacks, CameraState, ToolType } from '@canvas/contracts';

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

  // Merge callbacks with our handlers
  const mergedCallbacks: CanvasCallbacks = {
    ...callbacks,
    onCameraChange: (camera) => {
      callbacks?.onCameraChange?.(camera);
      onCameraChange?.(camera);
    },
    onCursorChange: (newCursor) => {
      callbacks?.onCursorChange?.(newCursor);
      setCursor(newCursor);
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
        style={{
          display: 'block',
          cursor,
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
        </div>
      )}
    </div>
  );
}

export default Canvas;
