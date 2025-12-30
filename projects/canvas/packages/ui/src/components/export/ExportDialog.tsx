/**
 * ExportDialog Component
 *
 * Modal dialog for configuring and executing exports.
 */

import { useState, useCallback } from 'react';
import type { ExportFormat, ExportQuality, ExportScope, ExportOptions } from './types';
import { DEFAULT_EXPORT_OPTIONS, QUALITY_SCALES } from './types';

export interface ExportDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Close the dialog */
  onClose: () => void;
  /** Execute export with options */
  onExport: (options: ExportOptions) => void;
  /** Whether export is in progress */
  isExporting?: boolean;
  /** Whether there's a selection */
  hasSelection?: boolean;
  /** Default options */
  defaultOptions?: Partial<ExportOptions>;
}

const formatLabels: Record<ExportFormat, string> = {
  png: 'PNG (Raster)',
  svg: 'SVG (Vector)',
  pdf: 'PDF (Document)',
};

const qualityLabels: Record<ExportQuality, string> = {
  low: `Low (${QUALITY_SCALES.low}x)`,
  medium: `Medium (${QUALITY_SCALES.medium}x)`,
  high: `High (${QUALITY_SCALES.high}x)`,
  ultra: `Ultra (${QUALITY_SCALES.ultra}x)`,
};

const scopeLabels: Record<ExportScope, string> = {
  all: 'Entire Canvas',
  selection: 'Selection Only',
  viewport: 'Current View',
};

/**
 * Export configuration dialog
 */
export function ExportDialog({
  isOpen,
  onClose,
  onExport,
  isExporting = false,
  hasSelection = false,
  defaultOptions,
}: ExportDialogProps) {
  const [options, setOptions] = useState<ExportOptions>({
    ...DEFAULT_EXPORT_OPTIONS,
    ...defaultOptions,
  });

  const handleFormatChange = useCallback((format: ExportFormat) => {
    setOptions((prev) => ({ ...prev, format }));
  }, []);

  const handleScopeChange = useCallback((scope: ExportScope) => {
    setOptions((prev) => ({ ...prev, scope }));
  }, []);

  const handleQualityChange = useCallback((quality: ExportQuality) => {
    setOptions((prev) => ({ ...prev, quality }));
  }, []);

  const handleScaleChange = useCallback((scale: number) => {
    setOptions((prev) => ({ ...prev, scale }));
  }, []);

  const handleBackgroundToggle = useCallback(() => {
    setOptions((prev) => ({
      ...prev,
      includeBackground: !prev.includeBackground,
    }));
  }, []);

  const handlePaddingChange = useCallback((padding: number) => {
    setOptions((prev) => ({ ...prev, padding }));
  }, []);

  const handleExport = useCallback(() => {
    onExport(options);
  }, [options, onExport]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#2d2d2d',
          borderRadius: 8,
          padding: 24,
          minWidth: 360,
          maxWidth: 480,
          color: 'white',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Export Canvas</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: 20,
              cursor: 'pointer',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Format selection */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#aaa', fontSize: 12 }}>
            Format
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['png', 'svg', 'pdf'] as ExportFormat[]).map((format) => (
              <button
                key={format}
                onClick={() => handleFormatChange(format)}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  backgroundColor: options.format === format ? '#4a9eff' : '#3d3d3d',
                  border: 'none',
                  borderRadius: 4,
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: options.format === format ? 600 : 400,
                }}
              >
                {formatLabels[format]}
              </button>
            ))}
          </div>
        </div>

        {/* Scope selection */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#aaa', fontSize: 12 }}>
            What to Export
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'selection', 'viewport'] as ExportScope[]).map((scope) => (
              <button
                key={scope}
                onClick={() => handleScopeChange(scope)}
                disabled={scope === 'selection' && !hasSelection}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  backgroundColor: options.scope === scope ? '#4a9eff' : '#3d3d3d',
                  border: 'none',
                  borderRadius: 4,
                  color: scope === 'selection' && !hasSelection ? '#666' : 'white',
                  cursor: scope === 'selection' && !hasSelection ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: options.scope === scope ? 600 : 400,
                }}
              >
                {scopeLabels[scope]}
              </button>
            ))}
          </div>
        </div>

        {/* Quality (for PNG/PDF) */}
        {options.format !== 'svg' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, color: '#aaa', fontSize: 12 }}>
              Quality
            </label>
            <select
              value={options.quality}
              onChange={(e) => handleQualityChange(e.target.value as ExportQuality)}
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#3d3d3d',
                border: 'none',
                borderRadius: 4,
                color: 'white',
                fontSize: 13,
              }}
            >
              {(['low', 'medium', 'high', 'ultra'] as ExportQuality[]).map((q) => (
                <option key={q} value={q}>
                  {qualityLabels[q]}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Scale */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#aaa', fontSize: 12 }}>
            Scale: {options.scale}x
          </label>
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.5"
            value={options.scale}
            onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Padding */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#aaa', fontSize: 12 }}>
            Padding: {options.padding}px
          </label>
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={options.padding}
            onChange={(e) => handlePaddingChange(parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Background toggle */}
        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <input
              type="checkbox"
              checked={options.includeBackground}
              onChange={handleBackgroundToggle}
            />
            Include background color
          </label>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#3d3d3d',
              border: 'none',
              borderRadius: 4,
              color: 'white',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            style={{
              padding: '10px 24px',
              backgroundColor: isExporting ? '#666' : '#4a9eff',
              border: 'none',
              borderRadius: 4,
              color: 'white',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportDialog;
