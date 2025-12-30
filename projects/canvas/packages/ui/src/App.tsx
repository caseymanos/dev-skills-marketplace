/**
 * App Component
 *
 * Main application shell with canvas and toolbar.
 */

import { useState, useCallback } from 'react';
import { Canvas } from './components';
import type { CameraState, ToolType } from '@canvas/contracts';

export function App() {
  const [tool, setTool] = useState<ToolType>('select');
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1 });

  const handleCameraChange = useCallback((newCamera: CameraState) => {
    setCamera(newCamera);
  }, []);

  const tools: { type: ToolType; label: string; shortcut: string }[] = [
    { type: 'select', label: 'Select', shortcut: 'V' },
    { type: 'pan', label: 'Pan', shortcut: 'H' },
    { type: 'rectangle', label: 'Rectangle', shortcut: 'R' },
    { type: 'ellipse', label: 'Ellipse', shortcut: 'O' },
    { type: 'line', label: 'Line', shortcut: 'L' },
    { type: 'pen', label: 'Pen', shortcut: 'P' },
    { type: 'text', label: 'Text', shortcut: 'T' },
  ];

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a1a1a',
        color: '#fff',
      }}
    >
      {/* Toolbar */}
      <header
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          backgroundColor: '#2d2d2d',
          borderBottom: '1px solid #404040',
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 600, marginRight: 16 }}>Canvas</span>

        {/* Tool buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          {tools.map(({ type, label, shortcut }) => (
            <button
              key={type}
              onClick={() => setTool(type)}
              title={`${label} (${shortcut})`}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                backgroundColor: tool === type ? '#4a9eff' : '#404040',
                color: '#fff',
                fontSize: 13,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

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
  );
}

export default App;
