/**
 * Accessibility Utilities
 *
 * WCAG-compliant accessibility helpers and hooks.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * ARIA live region politeness
 */
export type AriaLive = 'off' | 'polite' | 'assertive';

/**
 * Focus trap options
 */
export interface FocusTrapOptions {
  /** Initial element to focus */
  initialFocus?: HTMLElement | string;
  /** Element to return focus to on close */
  returnFocus?: HTMLElement;
  /** Allow focus to leave the trap */
  allowEscape?: boolean;
}

/**
 * Keyboard navigation direction
 */
export type NavigationDirection = 'horizontal' | 'vertical' | 'both';

/**
 * Get focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable]',
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(selectors)).filter(
    (el) => {
      // Check if element is visible
      const style = window.getComputedStyle(el);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        el.offsetParent !== null
      );
    }
  );
}

/**
 * Create a focus trap within a container
 */
export function createFocusTrap(
  container: HTMLElement,
  options: FocusTrapOptions = {}
): { activate: () => void; deactivate: () => void } {
  const { initialFocus, returnFocus, allowEscape = false } = options;
  let previousActiveElement: Element | null = null;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    if (allowEscape && event.shiftKey && event.key === 'Escape') return;

    const focusableElements = getFocusableElements(container);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  };

  return {
    activate: () => {
      previousActiveElement = document.activeElement;
      container.addEventListener('keydown', handleKeyDown);

      // Set initial focus
      if (initialFocus) {
        const target =
          typeof initialFocus === 'string'
            ? container.querySelector<HTMLElement>(initialFocus)
            : initialFocus;
        target?.focus();
      } else {
        const focusable = getFocusableElements(container);
        focusable[0]?.focus();
      }
    },
    deactivate: () => {
      container.removeEventListener('keydown', handleKeyDown);
      const returnTarget = returnFocus || previousActiveElement;
      if (returnTarget instanceof HTMLElement) {
        returnTarget.focus();
      }
    },
  };
}

/**
 * Hook for managing focus trap
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  options: FocusTrapOptions = {}
): void {
  useEffect(() => {
    if (!active || !containerRef.current) return;

    const trap = createFocusTrap(containerRef.current, options);
    trap.activate();

    return () => trap.deactivate();
  }, [active, containerRef, options]);
}

/**
 * Hook for arrow key navigation within a group
 */
export function useArrowNavigation(
  containerRef: React.RefObject<HTMLElement | null>,
  direction: NavigationDirection = 'both',
  loop = true
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const focusable = getFocusableElements(container);
      if (focusable.length === 0) return;

      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;

      const isHorizontal = direction === 'horizontal' || direction === 'both';
      const isVertical = direction === 'vertical' || direction === 'both';

      switch (event.key) {
        case 'ArrowRight':
          if (isHorizontal) {
            nextIndex = loop
              ? (currentIndex + 1) % focusable.length
              : Math.min(currentIndex + 1, focusable.length - 1);
          }
          break;
        case 'ArrowLeft':
          if (isHorizontal) {
            nextIndex = loop
              ? (currentIndex - 1 + focusable.length) % focusable.length
              : Math.max(currentIndex - 1, 0);
          }
          break;
        case 'ArrowDown':
          if (isVertical) {
            nextIndex = loop
              ? (currentIndex + 1) % focusable.length
              : Math.min(currentIndex + 1, focusable.length - 1);
          }
          break;
        case 'ArrowUp':
          if (isVertical) {
            nextIndex = loop
              ? (currentIndex - 1 + focusable.length) % focusable.length
              : Math.max(currentIndex - 1, 0);
          }
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = focusable.length - 1;
          break;
        default:
          return;
      }

      if (nextIndex !== currentIndex) {
        event.preventDefault();
        focusable[nextIndex].focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerRef, direction, loop]);
}

/**
 * Live region announcer for screen readers
 */
class LiveAnnouncer {
  private politeRegion: HTMLDivElement | null = null;
  private assertiveRegion: HTMLDivElement | null = null;

  constructor() {
    if (typeof document === 'undefined') return;
    this.createRegions();
  }

  private createRegions(): void {
    const style = {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: '0',
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: '0',
    };

    // Polite region
    this.politeRegion = document.createElement('div');
    this.politeRegion.setAttribute('aria-live', 'polite');
    this.politeRegion.setAttribute('aria-atomic', 'true');
    Object.assign(this.politeRegion.style, style);
    document.body.appendChild(this.politeRegion);

    // Assertive region
    this.assertiveRegion = document.createElement('div');
    this.assertiveRegion.setAttribute('aria-live', 'assertive');
    this.assertiveRegion.setAttribute('aria-atomic', 'true');
    Object.assign(this.assertiveRegion.style, style);
    document.body.appendChild(this.assertiveRegion);
  }

  announce(message: string, politeness: AriaLive = 'polite'): void {
    const region =
      politeness === 'assertive' ? this.assertiveRegion : this.politeRegion;

    if (!region) return;

    // Clear and set to trigger announcement
    region.textContent = '';
    requestAnimationFrame(() => {
      region.textContent = message;
    });
  }

  destroy(): void {
    this.politeRegion?.remove();
    this.assertiveRegion?.remove();
  }
}

// Singleton instance
let announcer: LiveAnnouncer | null = null;

export function getAnnouncer(): LiveAnnouncer {
  if (!announcer) {
    announcer = new LiveAnnouncer();
  }
  return announcer;
}

/**
 * Announce a message to screen readers
 */
export function announce(message: string, politeness: AriaLive = 'polite'): void {
  getAnnouncer().announce(message, politeness);
}

/**
 * Hook for announcing messages
 */
export function useAnnounce(): (message: string, politeness?: AriaLive) => void {
  return useCallback((message: string, politeness: AriaLive = 'polite') => {
    announce(message, politeness);
  }, []);
}

/**
 * Hook for detecting reduced motion preference
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return reducedMotion;
}

/**
 * Hook for detecting high contrast mode
 */
export function useHighContrast(): boolean {
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(forced-colors: active)');
    setHighContrast(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setHighContrast(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return highContrast;
}

/**
 * Generate a unique ID for ARIA relationships
 */
let idCounter = 0;
export function generateAriaId(prefix = 'aria'): string {
  return `${prefix}-${++idCounter}`;
}

/**
 * Hook for generating stable ARIA IDs
 */
export function useAriaId(prefix = 'aria'): string {
  const idRef = useRef<string | null>(null);
  if (!idRef.current) {
    idRef.current = generateAriaId(prefix);
  }
  return idRef.current;
}

/**
 * Skip link component props
 */
export interface SkipLinkProps {
  /** Target ID to skip to */
  targetId: string;
  /** Link text */
  children: React.ReactNode;
}

/**
 * Focus ring styles for consistency
 */
export const focusRingStyles = {
  outline: '2px solid #4a9eff',
  outlineOffset: '2px',
};

/**
 * Visually hidden styles (for screen reader only content)
 */
export const visuallyHiddenStyles: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * Check if element has visible text content
 */
export function hasVisibleText(element: HTMLElement): boolean {
  return (
    element.textContent?.trim() !== '' ||
    element.getAttribute('aria-label') !== null ||
    element.getAttribute('aria-labelledby') !== null
  );
}

/**
 * Get accessible name of an element
 */
export function getAccessibleName(element: HTMLElement): string {
  // Check aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labels = labelledBy
      .split(' ')
      .map((id) => document.getElementById(id)?.textContent)
      .filter(Boolean);
    if (labels.length > 0) {
      return labels.join(' ');
    }
  }

  // Check aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // Check for label element
  if (element.id) {
    const label = document.querySelector<HTMLLabelElement>(
      `label[for="${element.id}"]`
    );
    if (label) return label.textContent || '';
  }

  // Check text content
  return element.textContent?.trim() || '';
}
