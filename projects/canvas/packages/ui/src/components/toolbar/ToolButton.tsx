/**
 * ToolButton Component
 *
 * Individual tool button in the toolbar.
 */

import type { ToolDefinition, ToolbarStyle } from './types';
import { DEFAULT_TOOLBAR_STYLE } from './types';

export interface ToolButtonProps {
  tool: ToolDefinition;
  isActive: boolean;
  onClick: () => void;
  style?: Partial<ToolbarStyle>;
}

export function ToolButton({
  tool,
  isActive,
  onClick,
  style: customStyle,
}: ToolButtonProps) {
  const style = { ...DEFAULT_TOOLBAR_STYLE, ...customStyle };

  return (
    <button
      onClick={onClick}
      title={`${tool.label} (${tool.shortcut})`}
      aria-label={tool.label}
      aria-pressed={isActive}
      style={{
        width: style.buttonSize,
        height: style.buttonSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        backgroundColor: isActive ? style.activeColor : 'transparent',
        color: isActive ? '#fff' : '#ccc',
        fontSize: 18,
        transition: 'background-color 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = style.hoverColor;
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      {tool.icon}
    </button>
  );
}

export default ToolButton;
