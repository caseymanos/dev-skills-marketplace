/**
 * ExportMenu Component
 *
 * Dropdown menu for export options.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { CanvasEngine } from '@canvas/contracts';
import type { ExportFormat } from '../../hooks/useExport';
import { useExport } from '../../hooks/useExport';

export interface ExportMenuProps {
  /** Canvas engine instance */
  engine: CanvasEngine | null;
  /** Button style */
  style?: React.CSSProperties;
  /** Called when export starts */
  onExportStart?: (format: ExportFormat) => void;
  /** Called when export completes */
  onExportComplete?: (format: ExportFormat, success: boolean) => void;
}

interface ExportOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    format: 'png',
    label: 'PNG',
    description: 'Raster image format',
    icon: '🖼️',
  },
  {
    format: 'svg',
    label: 'SVG',
    description: 'Scalable vector graphics',
    icon: '📐',
  },
  {
    format: 'pdf',
    label: 'PDF',
    description: 'Portable document format',
    icon: '📄',
  },
];

/**
 * Export menu component
 */
export function ExportMenu({
  engine,
  style,
  onExportStart,
  onExportComplete,
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectionOnly, setSelectionOnly] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { isExporting, error, exportAndDownload } = useExport({
    fileNamePrefix: 'canvas',
    defaultScale: 2,
  });

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!engine) return;

      onExportStart?.(format);
      setIsOpen(false);

      try {
        await exportAndDownload(engine, format, { selectionOnly });
        onExportComplete?.(format, true);
      } catch {
        onExportComplete?.(format, false);
      }
    },
    [engine, exportAndDownload, selectionOnly, onExportStart, onExportComplete]
  );

  const hasSelection = (engine?.getSelection()?.selectedIds?.length ?? 0) > 0;

  return (
    <div ref={menuRef} style={{ position: 'relative', ...style }}>
      {/* Export button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={!engine || isExporting}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          border: '1px solid #444',
          borderRadius: '4px',
          backgroundColor: isOpen ? '#3a3a3a' : '#2a2a2a',
          color: '#fff',
          cursor: engine ? 'pointer' : 'not-allowed',
          opacity: engine ? 1 : 0.5,
          fontSize: '13px',
        }}
      >
        {isExporting ? (
          <>
            <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
            Exporting...
          </>
        ) : (
          <>
            <span>📥</span>
            Export
            <span style={{ fontSize: '10px' }}>{isOpen ? '▲' : '▼'}</span>
          </>
        )}
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            minWidth: '200px',
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Selection only toggle */}
          {hasSelection && (
            <div
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid #444',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: '#aaa',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectionOnly}
                  onChange={(e) => setSelectionOnly(e.target.checked)}
                  style={{ margin: 0 }}
                />
                Export selection only
              </label>
            </div>
          )}

          {/* Export options */}
          {EXPORT_OPTIONS.map((option) => (
            <button
              key={option.format}
              onClick={() => handleExport(option.format)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '12px',
                border: 'none',
                backgroundColor: 'transparent',
                color: '#fff',
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#3a3a3a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span style={{ fontSize: '18px' }}>{option.icon}</span>
              <div>
                <div style={{ fontWeight: 500 }}>{option.label}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>
                  {option.description}
                </div>
              </div>
            </button>
          ))}

          {/* Error message */}
          {error && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(255,0,0,0.1)',
                color: '#ff6b6b',
                fontSize: '12px',
                borderTop: '1px solid #444',
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ExportMenu;
