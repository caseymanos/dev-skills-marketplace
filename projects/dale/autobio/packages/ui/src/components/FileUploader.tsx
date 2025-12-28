'use client';

import React, { useCallback, useState } from 'react';
import { clsx } from 'clsx';
import { Upload, File, X, Check, AlertCircle } from 'lucide-react';

export interface FileUploaderProps {
  onUpload: (files: File[]) => Promise<void>;
  maxSize?: number; // in bytes
  accept?: string[];
  multiple?: boolean;
  className?: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
}

export function FileUploader({
  onUpload,
  maxSize = 5 * 1024 * 1024 * 1024, // 5GB default
  accept = ['.zip', '.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png'],
  multiple = true,
  className,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadingFile[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      await processFiles(droppedFiles);
    },
    [onUpload, maxSize]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        await processFiles(selectedFiles);
      }
    },
    [onUpload, maxSize]
  );

  const processFiles = async (newFiles: File[]) => {
    // Validate files
    const validFiles = newFiles.filter((file) => {
      if (file.size > maxSize) {
        console.error(`File ${file.name} exceeds max size`);
        return false;
      }
      return true;
    });

    // Add to state
    const uploadingFiles: UploadingFile[] = validFiles.map((file) => ({
      file,
      progress: 0,
      status: 'uploading' as const,
    }));

    setFiles((prev) => [...prev, ...uploadingFiles]);

    // Start upload
    try {
      await onUpload(validFiles);

      // Mark as complete
      setFiles((prev) =>
        prev.map((f) =>
          validFiles.includes(f.file)
            ? { ...f, status: 'complete' as const, progress: 100 }
            : f
        )
      );
    } catch (error) {
      // Mark as error
      setFiles((prev) =>
        prev.map((f) =>
          validFiles.includes(f.file)
            ? {
                ...f,
                status: 'error' as const,
                error: error instanceof Error ? error.message : 'Upload failed',
              }
            : f
        )
      );
    }
  };

  const removeFile = (file: File) => {
    setFiles((prev) => prev.filter((f) => f.file !== file));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={clsx(
          'border-2 border-dashed rounded-xl p-8 text-center transition-colors',
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        )}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          onChange={handleFileSelect}
          accept={accept.join(',')}
          multiple={multiple}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center"
        >
          <Upload
            className={clsx(
              'w-12 h-12 mb-4',
              isDragging ? 'text-blue-500' : 'text-gray-400'
            )}
          />
          <span className="text-lg font-medium text-gray-700">
            Drop files here or click to browse
          </span>
          <span className="text-sm text-gray-500 mt-2">
            Supports: ZIP, PDF, Word, Images, Text
          </span>
          <span className="text-xs text-gray-400 mt-1">
            Max file size: {formatSize(maxSize)}
          </span>
        </label>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((item, index) => (
            <div
              key={`${item.file.name}-${index}`}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
            >
              <File className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {item.file.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatSize(item.file.size)}
                  </span>
                </div>
                {item.status === 'uploading' && (
                  <div className="mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === 'error' && (
                  <span className="text-xs text-red-500 mt-1">{item.error}</span>
                )}
              </div>
              <div className="flex-shrink-0">
                {item.status === 'complete' && (
                  <Check className="w-5 h-5 text-green-500" />
                )}
                {item.status === 'error' && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
                {item.status !== 'uploading' && (
                  <button
                    onClick={() => removeFile(item.file)}
                    className="ml-2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
