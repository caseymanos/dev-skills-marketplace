'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { Sparkles, FileText, Image, Film, Music, Clock, Zap } from 'lucide-react';

export interface ProgressEvent {
  type: 'stage' | 'discovery' | 'complete';
  data: {
    stage?: string;
    progress?: number;
    message?: string;
    type?: string;
    preview?: string;
    status?: 'success' | 'error';
    nextStage?: string;
    error?: string;
  };
  timestamp: number;
}

export interface FileInfo {
  id: string;
  name: string;
  size_bytes: number;
  file_type: string;
}

export interface ProgressFeedProps {
  projectId: string;
  apiUrl?: string;
  token?: string;
  files?: FileInfo[];
  onComplete?: (status: 'success' | 'error', nextStage?: string) => void;
  className?: string;
}

// Estimate processing time based on file size and type (in seconds)
function estimateProcessingTime(files: FileInfo[]): number {
  let totalSeconds = 0;

  for (const file of files) {
    const sizeMB = file.size_bytes / (1024 * 1024);

    if (file.file_type === 'application/pdf') {
      // PDFs: ~15-30 seconds per MB (Claude vision processing)
      totalSeconds += Math.max(15, sizeMB * 20);
    } else if (file.file_type === 'application/zip') {
      // ZIPs: ~10 seconds per MB (extraction + processing)
      totalSeconds += Math.max(10, sizeMB * 10);
    } else if (file.file_type.startsWith('image/')) {
      // Images: ~5-10 seconds each
      totalSeconds += 8;
    } else if (file.file_type === 'text/plain') {
      // Text: ~3-5 seconds
      totalSeconds += 4;
    } else {
      // Other documents: ~10 seconds per MB
      totalSeconds += Math.max(5, sizeMB * 10);
    }
  }

  // Add overhead for analysis stage (~50% of parse time)
  totalSeconds *= 1.5;

  return Math.ceil(totalSeconds);
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
}

export function ProgressFeed({
  projectId,
  apiUrl = '',
  token,
  files = [],
  onComplete,
  className,
}: ProgressFeedProps) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [currentStage, setCurrentStage] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate estimated total time
  const estimatedTotalSeconds = estimateProcessingTime(files);

  // Calculate remaining time based on progress
  const estimatedRemainingSeconds = useCallback(() => {
    if (progress === 0 || elapsedSeconds === 0) {
      return estimatedTotalSeconds;
    }

    // Use actual elapsed time to project remaining time
    const progressPercent = progress / 100;
    if (progressPercent > 0) {
      const projectedTotal = elapsedSeconds / progressPercent;
      const remaining = Math.max(0, Math.ceil(projectedTotal - elapsedSeconds));
      return remaining;
    }

    return estimatedTotalSeconds - elapsedSeconds;
  }, [progress, elapsedSeconds, estimatedTotalSeconds]);

  // Start elapsed time counter
  useEffect(() => {
    if (isConnected && !startTime) {
      setStartTime(Date.now());
    }

    if (startTime) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isConnected, startTime]);

  useEffect(() => {
    // Connect to SSE endpoint with optional auth token
    let url = `${apiUrl}/api/projects/${projectId}/progress`;
    if (token) {
      url += `?token=${encodeURIComponent(token)}`;
    }
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    eventSource.addEventListener('stage', (e) => {
      const data = JSON.parse(e.data);
      setCurrentStage(data.stage);
      setProgress(data.progress);
      setMessage(data.message);

      setEvents((prev) => [
        ...prev,
        { type: 'stage', data, timestamp: Date.now() },
      ]);
    });

    eventSource.addEventListener('discovery', (e) => {
      const data = JSON.parse(e.data);
      setEvents((prev) => [
        ...prev,
        { type: 'discovery', data, timestamp: Date.now() },
      ]);
    });

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      setEvents((prev) => [
        ...prev,
        { type: 'complete', data, timestamp: Date.now() },
      ]);
      onComplete?.(data.status, data.nextStage);
      eventSource.close();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    });

    return () => {
      eventSource.close();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [projectId, apiUrl, token, onComplete]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  const getIcon = (type?: string) => {
    switch (type) {
      case 'text':
        return <FileText className="w-4 h-4" />;
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'video':
        return <Film className="w-4 h-4" />;
      case 'audio':
        return <Music className="w-4 h-4" />;
      case 'gem':
        return <Sparkles className="w-4 h-4 text-yellow-500" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const stageLabels: Record<string, string> = {
    parse: 'Parsing Files',
    analyze: 'Analyzing Content',
    curate: 'Curating Stories',
    write: 'Writing Narratives',
    build: 'Building Site',
    publish: 'Publishing',
  };

  const remaining = estimatedRemainingSeconds();

  return (
    <div className={clsx('bg-white rounded-xl border border-gray-200', className)}>
      {/* Header with progress bar */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className={clsx(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              )}
            />
            <span className="text-sm font-medium text-gray-700">
              {stageLabels[currentStage] || 'Processing...'}
            </span>
          </div>
          <span className="text-sm text-gray-500">{progress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Time estimates */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Elapsed: {formatTime(elapsedSeconds)}
            </span>
            {remaining > 0 && progress < 100 && (
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-yellow-500" />
                ~{formatTime(remaining)} remaining
              </span>
            )}
          </div>
          {files.length > 0 && (
            <span className="text-xs text-gray-400">
              {files.length} file{files.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {message && (
          <p className="text-xs text-gray-500 mt-2 truncate">{message}</p>
        )}
      </div>

      {/* Event feed */}
      <div
        ref={feedRef}
        className="max-h-64 overflow-y-auto px-4 py-3 space-y-2"
      >
        {events.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-400">
              Waiting for updates...
            </p>
            {files.length > 0 && (
              <p className="text-xs text-gray-300 mt-1">
                Estimated time: ~{formatTime(estimatedTotalSeconds)}
              </p>
            )}
          </div>
        ) : (
          events.map((event, index) => (
            <div
              key={index}
              className={clsx(
                'flex items-start gap-2 text-sm',
                event.type === 'complete' && 'font-medium',
                event.type === 'discovery' &&
                  event.data.type === 'gem' &&
                  'text-yellow-700'
              )}
            >
              <span className="text-gray-400 flex-shrink-0">
                {getIcon(event.data.type)}
              </span>
              <span
                className={clsx(
                  event.type === 'discovery'
                    ? 'text-gray-700'
                    : event.type === 'complete'
                    ? event.data.status === 'success'
                      ? 'text-green-700'
                      : 'text-red-700'
                    : 'text-gray-500'
                )}
              >
                {event.type === 'stage' && event.data.message}
                {event.type === 'discovery' && event.data.preview}
                {event.type === 'complete' &&
                  (event.data.status === 'success'
                    ? `Processing complete! (${formatTime(elapsedSeconds)})`
                    : `Error: ${event.data.error}`)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
