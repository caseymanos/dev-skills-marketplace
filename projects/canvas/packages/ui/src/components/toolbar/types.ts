/**
 * Toolbar Types
 *
 * Types for toolbar and drawing tools.
 */

import type { ToolType } from '@canvas/contracts';

/**
 * Tool definition for toolbar
 */
export interface ToolDefinition {
  type: ToolType;
  label: string;
  shortcut: string;
  icon: string; // Unicode or emoji for now, can be replaced with SVG
  group: 'selection' | 'shapes' | 'drawing' | 'text';
}

/**
 * All available tools
 */
export const TOOLS: ToolDefinition[] = [
  // Selection tools
  { type: 'select', label: 'Select', shortcut: 'V', icon: '⬚', group: 'selection' },
  { type: 'pan', label: 'Pan', shortcut: 'H', icon: '✋', group: 'selection' },

  // Shape tools
  { type: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: '▢', group: 'shapes' },
  { type: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: '◯', group: 'shapes' },
  { type: 'line', label: 'Line', shortcut: 'L', icon: '╱', group: 'shapes' },

  // Drawing tools
  { type: 'pen', label: 'Pen', shortcut: 'P', icon: '✏', group: 'drawing' },

  // Text tools
  { type: 'text', label: 'Text', shortcut: 'T', icon: 'T', group: 'text' },
];

/**
 * Get tool definition by type
 */
export function getToolDefinition(type: ToolType): ToolDefinition | undefined {
  return TOOLS.find((t) => t.type === type);
}

/**
 * Get tool by shortcut key
 */
export function getToolByShortcut(key: string): ToolDefinition | undefined {
  const upperKey = key.toUpperCase();
  return TOOLS.find((t) => t.shortcut === upperKey);
}

/**
 * Toolbar position
 */
export type ToolbarPosition = 'left' | 'top' | 'right' | 'bottom';

/**
 * Toolbar style options
 */
export interface ToolbarStyle {
  backgroundColor: string;
  borderColor: string;
  buttonSize: number;
  buttonGap: number;
  padding: number;
  activeColor: string;
  hoverColor: string;
}

/**
 * Default toolbar style
 */
export const DEFAULT_TOOLBAR_STYLE: ToolbarStyle = {
  backgroundColor: '#2d2d2d',
  borderColor: '#404040',
  buttonSize: 36,
  buttonGap: 4,
  padding: 8,
  activeColor: '#4a9eff',
  hoverColor: '#3d3d3d',
};
