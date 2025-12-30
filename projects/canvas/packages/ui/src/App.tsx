/**
 * App Component
 *
 * Main application shell with canvas and toolbar.
 */

import { useState, useCallback } from 'react';
import { Canvas, Toolbar } from './components';
import type { CameraState, ToolType } from '@canvas/contracts';

export function App() {
  const [tool, setTool] = useState<ToolType>('select');
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1 });

  const handleCameraChange = useCallback((newCamera: CameraState) => {
    setCamera(newCamera);
  }, []);

  const handleToolChange = useCallback((newTool: ToolType) => {
    setTool(newTool);
  }, []);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        backgroundColor: '#1a1a1a',
        color: '#fff',
      }}
    >
      {/* Left sidebar with toolbar */}
      <aside
        style={{
          width: 56,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          backgroundColor: '#252525',
          borderRight: '1px solid #404040',
        }}
      >
        <Toolbar
          activeTool={tool}
          onToolChange={handleToolChange}
          position="left"
          enableShortcuts
        />
      </aside>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <header
          style={{
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            backgroundColor: '#2d2d2d',
            borderBottom: '1px solid #404040',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14 }}>Collaborative Canvas</span>

          {/* Camera info */}
          <div
            style={{
              fontSize: 12,
              fontFamily: 'monospace',
              color: '#888',
            }}
          >
            {Math.round(camera.zoom * 100)}% | ({Math.round(camera.x)},{' '}
            {Math.round(camera.y)})
          </div>
        </header>

        {/* Canvas */}
        <main style={{ flex: 1, position: 'relative' }}>
          <Canvas
            tool={tool}
            onCameraChange={handleCameraChange}
            debug
            style={{ width: '100%', height: '100%' }}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
