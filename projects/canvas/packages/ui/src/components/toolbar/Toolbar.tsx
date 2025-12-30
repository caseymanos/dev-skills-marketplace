/**
 * Toolbar Component
 *
 * Vertical or horizontal toolbar with drawing tools.
 */

import { useCallback, useEffect } from 'react';
import type { ToolType } from '@canvas/contracts';
import { ToolButton } from './ToolButton';
import {
  TOOLS,
  getToolByShortcut,
  type ToolbarPosition,
  type ToolbarStyle,
  DEFAULT_TOOLBAR_STYLE,
} from './types';

export interface ToolbarProps {
  /** Currently active tool */
  activeTool: ToolType;
  /** Called when tool changes */
  onToolChange: (tool: ToolType) => void;
  /** Toolbar position */
  position?: ToolbarPosition;
  /** Custom style overrides */
  style?: Partial<ToolbarStyle>;
  /** Additional CSS class */
  className?: string;
  /** Enable keyboard shortcuts */
  enableShortcuts?: boolean;
}

export function Toolbar({
  activeTool,
  onToolChange,
  position = 'left',
  style: customStyle,
  className,
  enableShortcuts = true,
}: ToolbarProps) {
  const style = { ...DEFAULT_TOOLBAR_STYLE, ...customStyle };

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!enableShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Ignore if modifier keys are pressed (except for shortcuts that need them)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const tool = getToolByShortcut(e.key);
      if (tool) {
        e.preventDefault();
        onToolChange(tool.type);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableShortcuts, onToolChange]);

  const handleToolClick = useCallback(
    (toolType: ToolType) => {
      onToolChange(toolType);
    },
    [onToolChange]
  );

  // Group tools by category
  const selectionTools = TOOLS.filter((t) => t.group === 'selection');
  const shapeTools = TOOLS.filter((t) => t.group === 'shapes');
  const drawingTools = TOOLS.filter((t) => t.group === 'drawing');
  const textTools = TOOLS.filter((t) => t.group === 'text');

  const isVertical = position === 'left' || position === 'right';

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: isVertical ? 'column' : 'row',
    backgroundColor: style.backgroundColor,
    borderRadius: 8,
    padding: style.padding,
    gap: style.buttonGap,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  };

  const dividerStyle: React.CSSProperties = {
    width: isVertical ? '100%' : 1,
    height: isVertical ? 1 : '100%',
    backgroundColor: style.borderColor,
    margin: isVertical ? '4px 0' : '0 4px',
  };

  const renderToolGroup = (tools: typeof TOOLS) => (
    <>
      {tools.map((tool) => (
        <ToolButton
          key={tool.type}
          tool={tool}
          isActive={activeTool === tool.type}
          onClick={() => handleToolClick(tool.type)}
          style={style}
        />
      ))}
    </>
  );

  return (
    <div className={className} style={containerStyle}>
      {renderToolGroup(selectionTools)}
      <div style={dividerStyle} />
      {renderToolGroup(shapeTools)}
      <div style={dividerStyle} />
      {renderToolGroup(drawingTools)}
      <div style={dividerStyle} />
      {renderToolGroup(textTools)}
    </div>
  );
}

export default Toolbar;
