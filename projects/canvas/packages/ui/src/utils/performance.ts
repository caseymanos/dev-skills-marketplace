/**
 * Performance Utilities
 *
 * Tools for measuring and monitoring application performance.
 */

/**
 * Performance metric types
 */
export type MetricType = 'render' | 'update' | 'sync' | 'load' | 'custom';

/**
 * Performance measurement
 */
export interface PerformanceMeasurement {
  name: string;
  type: MetricType;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Performance stats for a metric
 */
export interface PerformanceStats {
  name: string;
  count: number;
  total: number;
  min: number;
  max: number;
  avg: number;
  p95: number;
  p99: number;
}

/**
 * Performance monitor singleton
 */
class PerformanceMonitor {
  private measurements: PerformanceMeasurement[] = [];
  private maxMeasurements = 1000;
  private enabled = true;
  private listeners: Set<(measurement: PerformanceMeasurement) => void> = new Set();

  /**
   * Enable or disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Start a performance measurement
   */
  start(name: string, type: MetricType = 'custom'): () => void {
    if (!this.enabled) return () => {};

    const startTime = performance.now();

    return (metadata?: Record<string, unknown>) => {
      const duration = performance.now() - startTime;
      this.record(name, type, duration, metadata);
    };
  }

  /**
   * Record a measurement directly
   */
  record(
    name: string,
    type: MetricType,
    duration: number,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.enabled) return;

    const measurement: PerformanceMeasurement = {
      name,
      type,
      duration,
      timestamp: Date.now(),
      metadata,
    };

    this.measurements.push(measurement);

    // Trim old measurements
    if (this.measurements.length > this.maxMeasurements) {
      this.measurements = this.measurements.slice(-this.maxMeasurements);
    }

    // Notify listeners
    this.listeners.forEach((listener) => listener(measurement));
  }

  /**
   * Measure an async function
   */
  async measureAsync<T>(
    name: string,
    type: MetricType,
    fn: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const end = this.start(name, type);
    try {
      const result = await fn();
      end(metadata);
      return result;
    } catch (error) {
      end({ ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Measure a sync function
   */
  measure<T>(
    name: string,
    type: MetricType,
    fn: () => T,
    metadata?: Record<string, unknown>
  ): T {
    const end = this.start(name, type);
    try {
      const result = fn();
      end(metadata);
      return result;
    } catch (error) {
      end({ ...metadata, error: true });
      throw error;
    }
  }

  /**
   * Get measurements for a specific metric
   */
  getMeasurements(name?: string, type?: MetricType): PerformanceMeasurement[] {
    return this.measurements.filter((m) => {
      if (name && m.name !== name) return false;
      if (type && m.type !== type) return false;
      return true;
    });
  }

  /**
   * Get statistics for a metric
   */
  getStats(name: string): PerformanceStats | null {
    const measurements = this.getMeasurements(name);
    if (measurements.length === 0) return null;

    const durations = measurements.map((m) => m.duration).sort((a, b) => a - b);
    const count = durations.length;
    const total = durations.reduce((a, b) => a + b, 0);

    return {
      name,
      count,
      total,
      min: durations[0],
      max: durations[count - 1],
      avg: total / count,
      p95: durations[Math.floor(count * 0.95)] ?? durations[count - 1],
      p99: durations[Math.floor(count * 0.99)] ?? durations[count - 1],
    };
  }

  /**
   * Get all stats grouped by name
   */
  getAllStats(): Map<string, PerformanceStats> {
    const names = new Set(this.measurements.map((m) => m.name));
    const stats = new Map<string, PerformanceStats>();

    names.forEach((name) => {
      const s = this.getStats(name);
      if (s) stats.set(name, s);
    });

    return stats;
  }

  /**
   * Subscribe to measurements
   */
  subscribe(listener: (measurement: PerformanceMeasurement) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements = [];
  }

  /**
   * Log stats to console
   */
  logStats(): void {
    const stats = this.getAllStats();
    console.group('Performance Stats');
    stats.forEach((s, name) => {
      console.log(
        `${name}: avg=${s.avg.toFixed(2)}ms, min=${s.min.toFixed(2)}ms, max=${s.max.toFixed(2)}ms, p95=${s.p95.toFixed(2)}ms (n=${s.count})`
      );
    });
    console.groupEnd();
  }
}

// Singleton instance
export const perfMonitor = new PerformanceMonitor();

/**
 * Decorator for measuring method performance
 */
export function measurePerformance(name: string, type: MetricType = 'custom') {
  return function <T extends (...args: unknown[]) => unknown>(
    _target: unknown,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> {
    const originalMethod = descriptor.value;

    if (originalMethod) {
      descriptor.value = function (this: unknown, ...args: unknown[]) {
        return perfMonitor.measure(name, type, () => originalMethod.apply(this, args));
      } as T;
    }

    return descriptor;
  };
}

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = wait - (now - lastCall);

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      fn.apply(this, args);
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn.apply(this, args);
    }, wait);
  };
}

/**
 * Request idle callback polyfill
 */
export const requestIdleCallback =
  typeof window !== 'undefined' && 'requestIdleCallback' in window
    ? window.requestIdleCallback
    : (cb: IdleRequestCallback): number => {
        const start = Date.now();
        return window.setTimeout(() => {
          cb({
            didTimeout: false,
            timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
          });
        }, 1) as unknown as number;
      };

/**
 * Cancel idle callback polyfill
 */
export const cancelIdleCallback =
  typeof window !== 'undefined' && 'cancelIdleCallback' in window
    ? window.cancelIdleCallback
    : (id: number): void => clearTimeout(id);

/**
 * Run a task during idle time
 */
export function runWhenIdle<T>(
  task: () => T,
  timeout = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    requestIdleCallback(
      () => {
        try {
          resolve(task());
        } catch (error) {
          reject(error);
        }
      },
      { timeout }
    );
  });
}

/**
 * Batch updates using requestAnimationFrame
 */
export function batchUpdates(updates: Array<() => void>): void {
  requestAnimationFrame(() => {
    updates.forEach((update) => update());
  });
}

/**
 * Memory-efficient object pool
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private reset: (obj: T) => void;

  constructor(factory: () => T, reset: (obj: T) => void, initialSize = 10) {
    this.factory = factory;
    this.reset = reset;

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    return this.pool.pop() ?? this.factory();
  }

  release(obj: T): void {
    this.reset(obj);
    this.pool.push(obj);
  }

  get size(): number {
    return this.pool.length;
  }
}
