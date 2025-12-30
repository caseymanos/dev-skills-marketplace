/**
 * App Component
 *
 * Main application shell with canvas and toolbar.
 */

import { useState, useCallback, useMemo } from 'react';
import { Canvas, Toolbar, HistoryButtons } from './components';
import { useHistory, useKeyboardShortcuts, COMMON_SHORTCUTS } from './hooks';
import type { CameraState, ToolType } from '@canvas/contracts';
import type { Shortcut } from './hooks';

export function App() {
  const [tool, setTool] = useState<ToolType>('select');
  const [camera, setCamera] = useState<CameraState>({ x: 0, y: 0, zoom: 1 });

  // History management
  const { state: historyState, undo, redo } = useHistory();

  const handleCameraChange = useCallback((newCamera: CameraState) => {
    setCamera(newCamera);
  }, []);

  const handleToolChange = useCallback((newTool: ToolType) => {
    setTool(newTool);
  }, []);

  // Keyboard shortcuts
  const shortcuts: Shortcut[] = useMemo(
    () => [
      {
        ...COMMON_SHORTCUTS.undo,
        handler: () => undo(),
      },
      {
        ...COMMON_SHORTCUTS.redo,
        handler: () => redo(),
      },
      {
        ...COMMON_SHORTCUTS.redoAlt,
        handler: () => redo(),
      },
    ],
    [undo, redo]
  );

  useKeyboardShortcuts({ shortcuts, enabled: true });

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
          gap: 12,
        }}
      >
        <Toolbar
          activeTool={tool}
          onToolChange={handleToolChange}
          position="left"
          enableShortcuts
        />

        {/* Divider */}
        <div
          style={{
            width: '80%',
            height: 1,
            backgroundColor: '#404040',
          }}
        />

        {/* History buttons */}
        <HistoryButtons
          historyState={historyState}
          onUndo={undo}
          onRedo={redo}
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

          {/* Status info */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              fontSize: 12,
              fontFamily: 'monospace',
              color: '#888',
            }}
          >
            {historyState.undoCount > 0 && (
              <span>History: {historyState.undoCount}</span>
            )}
            <span>
              {Math.round(camera.zoom * 100)}% | ({Math.round(camera.x)},{' '}
              {Math.round(camera.y)})
            </span>
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
