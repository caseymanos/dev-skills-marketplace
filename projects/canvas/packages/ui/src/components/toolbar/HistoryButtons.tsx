/**
 * HistoryButtons Component
 *
 * Undo and Redo buttons for the toolbar.
 */

import type { HistoryState } from '../../hooks/useHistory';
import type { ToolbarStyle } from './types';
import { DEFAULT_TOOLBAR_STYLE } from './types';

export interface HistoryButtonsProps {
  /** Current history state */
  historyState: HistoryState;
  /** Called when undo is clicked */
  onUndo: () => void;
  /** Called when redo is clicked */
  onRedo: () => void;
  /** Custom style overrides */
  style?: Partial<ToolbarStyle>;
  /** Orientation */
  vertical?: boolean;
}

export function HistoryButtons({
  historyState,
  onUndo,
  onRedo,
  style: customStyle,
  vertical = true,
}: HistoryButtonsProps) {
  const style = { ...DEFAULT_TOOLBAR_STYLE, ...customStyle };

  const buttonStyle = (enabled: boolean): React.CSSProperties => ({
    width: style.buttonSize,
    height: style.buttonSize,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: 6,
    cursor: enabled ? 'pointer' : 'not-allowed',
    backgroundColor: 'transparent',
    color: enabled ? '#ccc' : '#555',
    fontSize: 18,
    opacity: enabled ? 1 : 0.5,
    transition: 'background-color 0.15s, color 0.15s',
  });

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: vertical ? 'column' : 'row',
        gap: style.buttonGap,
      }}
    >
      <button
        onClick={onUndo}
        disabled={!historyState.canUndo}
        title={`Undo${historyState.nextUndo ? `: ${historyState.nextUndo}` : ''} (${modKey}+Z)`}
        aria-label="Undo"
        style={buttonStyle(historyState.canUndo)}
        onMouseEnter={(e) => {
          if (historyState.canUndo) {
            e.currentTarget.style.backgroundColor = style.hoverColor;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        ↩
      </button>

      <button
        onClick={onRedo}
        disabled={!historyState.canRedo}
        title={`Redo${historyState.nextRedo ? `: ${historyState.nextRedo}` : ''} (${modKey}+Shift+Z)`}
        aria-label="Redo"
        style={buttonStyle(historyState.canRedo)}
        onMouseEnter={(e) => {
          if (historyState.canRedo) {
            e.currentTarget.style.backgroundColor = style.hoverColor;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        ↪
      </button>
    </div>
  );
}

export default HistoryButtons;
