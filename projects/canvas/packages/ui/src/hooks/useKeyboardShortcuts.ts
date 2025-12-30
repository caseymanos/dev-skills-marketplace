/**
 * useKeyboardShortcuts Hook
 *
 * Manages global keyboard shortcuts for the canvas application.
 */

import { useEffect, useRef } from 'react';

/**
 * Shortcut definition
 */
export interface Shortcut {
  /** Key code (e.g., 'z', 'Delete', 'Escape') */
  key: string;
  /** Require Ctrl key (Cmd on Mac) */
  ctrl?: boolean;
  /** Require Shift key */
  shift?: boolean;
  /** Require Alt key */
  alt?: boolean;
  /** Handler function */
  handler: (event: KeyboardEvent) => void;
  /** Description for UI */
  description?: string;
  /** Prevent default browser behavior */
  preventDefault?: boolean;
}

interface UseKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled */
  enabled?: boolean;
  /** Shortcuts to register */
  shortcuts: Shortcut[];
}

/**
 * Check if an element is an input element
 */
function isInputElement(element: EventTarget | null): boolean {
  if (!element || !(element instanceof HTMLElement)) return false;

  const tagName = element.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.isContentEditable
  );
}

/**
 * Check if shortcut matches event
 */
function matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
  // Check key (case-insensitive)
  if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
    return false;
  }

  // Check modifiers
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const ctrlKey = isMac ? event.metaKey : event.ctrlKey;

  if (shortcut.ctrl && !ctrlKey) return false;
  if (!shortcut.ctrl && ctrlKey) return false;

  if (shortcut.shift && !event.shiftKey) return false;
  if (!shortcut.shift && event.shiftKey && shortcut.ctrl) return false; // Allow shift without explicit requirement only for non-ctrl shortcuts

  if (shortcut.alt && !event.altKey) return false;
  if (!shortcut.alt && event.altKey) return false;

  return true;
}

/**
 * Hook for managing keyboard shortcuts
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const { enabled = true, shortcuts } = options;
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in an input
      if (isInputElement(event.target)) {
        return;
      }

      for (const shortcut of shortcutsRef.current) {
        if (matchesShortcut(event, shortcut)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.handler(event);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}

/**
 * Common shortcuts for canvas applications
 */
export const COMMON_SHORTCUTS = {
  undo: { key: 'z', ctrl: true, description: 'Undo' },
  redo: { key: 'z', ctrl: true, shift: true, description: 'Redo' },
  redoAlt: { key: 'y', ctrl: true, description: 'Redo' },
  delete: { key: 'Delete', description: 'Delete selected' },
  backspace: { key: 'Backspace', description: 'Delete selected' },
  selectAll: { key: 'a', ctrl: true, description: 'Select all' },
  deselect: { key: 'Escape', description: 'Deselect' },
  copy: { key: 'c', ctrl: true, description: 'Copy' },
  paste: { key: 'v', ctrl: true, description: 'Paste' },
  cut: { key: 'x', ctrl: true, description: 'Cut' },
  duplicate: { key: 'd', ctrl: true, description: 'Duplicate' },
  save: { key: 's', ctrl: true, description: 'Save' },
  zoomIn: { key: '=', ctrl: true, description: 'Zoom in' },
  zoomOut: { key: '-', ctrl: true, description: 'Zoom out' },
  zoomReset: { key: '0', ctrl: true, description: 'Reset zoom' },
  fitToScreen: { key: '1', ctrl: true, description: 'Fit to screen' },
} as const;

export default useKeyboardShortcuts;
