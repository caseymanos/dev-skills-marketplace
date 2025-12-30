/**
 * useImageUpload Hook
 *
 * Handles image file selection, drag-and-drop, and loading.
 */

import { useState, useCallback, useRef } from 'react';
import type {
  ImageUploadResult,
  ImageFormat,
  ImageLoadState,
  DropZoneState,
} from '../components/media/types';
import { SUPPORTED_IMAGE_TYPES } from '../components/media/types';

interface UseImageUploadOptions {
  /** Called when image is successfully loaded */
  onImageLoaded?: (result: ImageUploadResult) => void;
  /** Called on error */
  onError?: (error: Error) => void;
  /** Maximum file size in bytes (default 10MB) */
  maxFileSize?: number;
}

interface UseImageUploadReturn {
  /** Current loading state */
  loadState: ImageLoadState;
  /** Drop zone state for drag-and-drop */
  dropZone: DropZoneState;
  /** Error message if any */
  error: string | null;
  /** Open file picker dialog */
  openFilePicker: () => void;
  /** Load image from URL */
  loadFromUrl: (url: string) => Promise<ImageUploadResult | null>;
  /** Handle file input change */
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Handle drag over */
  handleDragOver: (event: React.DragEvent) => void;
  /** Handle drag leave */
  handleDragLeave: () => void;
  /** Handle drop */
  handleDrop: (event: React.DragEvent) => void;
  /** Reference to hidden file input */
  fileInputRef: React.RefObject<HTMLInputElement>;
}

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Generate a unique ID for uploaded images
 */
function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if a file type is supported
 */
function isSupportedType(type: string): type is ImageFormat {
  return SUPPORTED_IMAGE_TYPES.includes(type as ImageFormat);
}

/**
 * Load an image element from a source
 */
function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

/**
 * Read a file as data URL
 */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Hook for handling image uploads
 */
export function useImageUpload(
  options: UseImageUploadOptions = {}
): UseImageUploadReturn {
  const { onImageLoaded, onError, maxFileSize = DEFAULT_MAX_FILE_SIZE } = options;

  const [loadState, setLoadState] = useState<ImageLoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dropZone, setDropZone] = useState<DropZoneState>({
    isDragOver: false,
    isValidDrop: false,
  });

  const fileInputRef = useRef<HTMLInputElement>(null!);

  const processFile = useCallback(
    async (file: File): Promise<ImageUploadResult | null> => {
      // Validate file type
      if (!isSupportedType(file.type)) {
        const err = new Error(`Unsupported file type: ${file.type}`);
        setError(err.message);
        onError?.(err);
        return null;
      }

      // Validate file size
      if (file.size > maxFileSize) {
        const maxMB = Math.round(maxFileSize / 1024 / 1024);
        const err = new Error(`File too large. Maximum size is ${maxMB}MB`);
        setError(err.message);
        onError?.(err);
        return null;
      }

      setLoadState('loading');
      setError(null);

      try {
        // Read file as data URL
        const dataUrl = await readFileAsDataUrl(file);

        // Load image to get dimensions
        const img = await loadImageElement(dataUrl);

        const result: ImageUploadResult = {
          id: generateImageId(),
          src: dataUrl,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type as ImageFormat,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        };

        setLoadState('loaded');
        onImageLoaded?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load image');
        setLoadState('error');
        setError(error.message);
        onError?.(error);
        return null;
      }
    },
    [maxFileSize, onImageLoaded, onError]
  );

  const loadFromUrl = useCallback(
    async (url: string): Promise<ImageUploadResult | null> => {
      setLoadState('loading');
      setError(null);

      try {
        const img = await loadImageElement(url);

        const result: ImageUploadResult = {
          id: generateImageId(),
          src: url,
          mimeType: 'image/png', // Assume PNG for URLs
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        };

        setLoadState('loaded');
        onImageLoaded?.(result);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load image from URL');
        setLoadState('error');
        setError(error.message);
        onError?.(error);
        return null;
      }
    },
    [onImageLoaded, onError]
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        processFile(file);
      }
      // Reset input so same file can be selected again
      event.target.value = '';
    },
    [processFile]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const hasImageFile = Array.from(event.dataTransfer.types).includes('Files');
    setDropZone({
      isDragOver: true,
      isValidDrop: hasImageFile,
    });
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropZone({
      isDragOver: false,
      isValidDrop: false,
    });
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      setDropZone({
        isDragOver: false,
        isValidDrop: false,
      });

      const file = event.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        processFile(file);
      }
    },
    [processFile]
  );

  return {
    loadState,
    dropZone,
    error,
    openFilePicker,
    loadFromUrl,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    fileInputRef,
  };
}

export default useImageUpload;
