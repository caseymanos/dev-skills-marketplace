/**
 * Image Cache
 *
 * LRU cache for loaded images with memory management.
 */

/**
 * Cached image entry
 */
interface CacheEntry {
  image: HTMLImageElement;
  src: string;
  size: number; // Estimated memory size in bytes
  lastAccessed: number;
  loadPromise: Promise<HTMLImageElement>;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Number of cached images */
  count: number;
  /** Total estimated memory usage in bytes */
  memoryUsage: number;
  /** Cache hit rate (0-1) */
  hitRate: number;
  /** Number of cache hits */
  hits: number;
  /** Number of cache misses */
  misses: number;
}

/**
 * Image cache options
 */
export interface ImageCacheOptions {
  /** Maximum number of images to cache */
  maxEntries?: number;
  /** Maximum total memory usage in bytes */
  maxMemory?: number;
  /** Time in ms after which unused entries are evicted */
  ttl?: number;
}

const DEFAULT_OPTIONS: Required<ImageCacheOptions> = {
  maxEntries: 100,
  maxMemory: 100 * 1024 * 1024, // 100MB
  ttl: 5 * 60 * 1000, // 5 minutes
};

/**
 * LRU Image Cache
 */
class ImageCache {
  private cache: Map<string, CacheEntry> = new Map();
  private options: Required<ImageCacheOptions>;
  private hits = 0;
  private misses = 0;
  private totalMemory = 0;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: ImageCacheOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.startCleanupTimer();
  }

  /**
   * Start periodic cleanup timer
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.evictStale();
    }, 30000); // Run every 30 seconds
  }

  /**
   * Stop cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Estimate image memory size
   */
  private estimateSize(width: number, height: number): number {
    // 4 bytes per pixel (RGBA)
    return width * height * 4;
  }

  /**
   * Evict least recently used entries until within limits
   */
  private evictLRU(): void {
    if (
      this.cache.size <= this.options.maxEntries &&
      this.totalMemory <= this.options.maxMemory
    ) {
      return;
    }

    // Sort by last accessed time
    const entries = Array.from(this.cache.entries()).sort(
      (a, b) => a[1].lastAccessed - b[1].lastAccessed
    );

    // Evict oldest entries
    for (const [key, entry] of entries) {
      if (
        this.cache.size <= this.options.maxEntries &&
        this.totalMemory <= this.options.maxMemory
      ) {
        break;
      }

      this.cache.delete(key);
      this.totalMemory -= entry.size;
    }
  }

  /**
   * Evict stale entries based on TTL
   */
  private evictStale(): void {
    const now = Date.now();
    const staleTime = now - this.options.ttl;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < staleTime) {
        this.cache.delete(key);
        this.totalMemory -= entry.size;
      }
    }
  }

  /**
   * Load an image from cache or network
   */
  async load(src: string): Promise<HTMLImageElement> {
    // Check cache first
    const cached = this.cache.get(src);
    if (cached) {
      this.hits++;
      cached.lastAccessed = Date.now();
      // Move to end (most recently used)
      this.cache.delete(src);
      this.cache.set(src, cached);
      return cached.loadPromise;
    }

    this.misses++;

    // Create loading promise
    const loadPromise = this.loadImage(src);

    // Create cache entry
    const entry: CacheEntry = {
      image: null as unknown as HTMLImageElement,
      src,
      size: 0,
      lastAccessed: Date.now(),
      loadPromise,
    };

    this.cache.set(src, entry);

    try {
      const image = await loadPromise;
      entry.image = image;
      entry.size = this.estimateSize(image.naturalWidth, image.naturalHeight);
      this.totalMemory += entry.size;

      // Evict if necessary
      this.evictLRU();

      return image;
    } catch (error) {
      // Remove failed entry
      this.cache.delete(src);
      throw error;
    }
  }

  /**
   * Load image from network
   */
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));

      img.src = src;
    });
  }

  /**
   * Check if an image is cached
   */
  has(src: string): boolean {
    return this.cache.has(src);
  }

  /**
   * Get cached image synchronously (returns null if not cached)
   */
  get(src: string): HTMLImageElement | null {
    const cached = this.cache.get(src);
    if (cached?.image) {
      cached.lastAccessed = Date.now();
      return cached.image;
    }
    return null;
  }

  /**
   * Preload images in the background
   */
  async preload(srcs: string[]): Promise<void> {
    await Promise.allSettled(srcs.map((src) => this.load(src)));
  }

  /**
   * Remove an image from cache
   */
  remove(src: string): void {
    const entry = this.cache.get(src);
    if (entry) {
      this.totalMemory -= entry.size;
      this.cache.delete(src);
    }
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.totalMemory = 0;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      count: this.cache.size,
      memoryUsage: this.totalMemory,
      hitRate: total > 0 ? this.hits / total : 0,
      hits: this.hits,
      misses: this.misses,
    };
  }

  /**
   * Set cache options
   */
  setOptions(options: Partial<ImageCacheOptions>): void {
    Object.assign(this.options, options);
    this.evictLRU();
  }
}

// Singleton instance
export const imageCache = new ImageCache();

/**
 * Hook-friendly image loading with caching
 */
export async function loadCachedImage(src: string): Promise<HTMLImageElement> {
  return imageCache.load(src);
}

/**
 * Get cached image synchronously
 */
export function getCachedImage(src: string): HTMLImageElement | null {
  return imageCache.get(src);
}

/**
 * Preload multiple images
 */
export async function preloadImages(srcs: string[]): Promise<void> {
  return imageCache.preload(srcs);
}

export default imageCache;
