/**
 * Utilities
 *
 * Performance and optimization utilities.
 */

export {
  perfMonitor,
  measurePerformance,
  throttle,
  debounce,
  requestIdleCallback,
  cancelIdleCallback,
  runWhenIdle,
  batchUpdates,
  ObjectPool,
} from './performance';

export type {
  MetricType,
  PerformanceMeasurement,
  PerformanceStats,
} from './performance';

export {
  imageCache,
  loadCachedImage,
  getCachedImage,
  preloadImages,
} from './imageCache';

export type {
  CacheStats,
  ImageCacheOptions,
} from './imageCache';

// Accessibility utilities
export {
  getFocusableElements,
  createFocusTrap,
  useFocusTrap,
  useArrowNavigation,
  announce,
  useAnnounce,
  useReducedMotion,
  useHighContrast,
  generateAriaId,
  useAriaId,
  focusRingStyles,
  visuallyHiddenStyles,
  hasVisibleText,
  getAccessibleName,
} from './accessibility';

export type {
  AriaLive,
  FocusTrapOptions,
  NavigationDirection,
  SkipLinkProps,
} from './accessibility';
