// API client for communicating with the Workers backend

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

interface ApiOptions extends RequestInit {
  token?: string;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error?.code || 'UNKNOWN_ERROR',
      data.error?.message || 'An error occurred',
      data.error?.details
    );
  }

  return data as T;
}

// Project endpoints
export const projects = {
  list: (token: string) =>
    request<{ projects: Project[] }>('/api/projects', { token }),

  get: (id: string, token: string) =>
    request<Project>(`/api/projects/${id}`, { token }),

  create: (name: string, token: string) =>
    request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name }),
      token,
    }),

  delete: (id: string, token: string) =>
    request<void>(`/api/projects/${id}`, {
      method: 'DELETE',
      token,
    }),

  reset: (id: string, token: string) =>
    request<{ success: boolean; message: string }>(`/api/projects/${id}/reset`, {
      method: 'POST',
      token,
    }),

  clearChapters: (id: string, token: string) =>
    request<{ success: boolean; message: string }>(`/api/projects/${id}/clear-chapters`, {
      method: 'POST',
      token,
    }),

  clearNarratives: (id: string, token: string) =>
    request<{ success: boolean; message: string }>(`/api/projects/${id}/clear-narratives`, {
      method: 'POST',
      token,
    }),
};

// Upload endpoints
export const uploads = {
  list: (projectId: string, token: string) =>
    request<{ files: UploadedFile[] }>(`/api/projects/${projectId}/upload`, { token }),

  getUploadUrl: (
    projectId: string,
    file: { filename: string; contentType: string; sizeBytes: number },
    token: string
  ) =>
    request<{ file_id: string; upload_url: string; expires_at: string }>(
      `/api/projects/${projectId}/upload`,
      {
        method: 'POST',
        body: JSON.stringify({
          filename: file.filename,
          content_type: file.contentType,
          size_bytes: file.sizeBytes,
        }),
        token,
      }
    ),

  complete: (projectId: string, fileId: string, token: string) =>
    request<{ file_id: string; status: string; queued: boolean }>(
      `/api/projects/${projectId}/upload/complete`,
      {
        method: 'POST',
        body: JSON.stringify({ file_id: fileId }),
        token,
      }
    ),
};

export interface UploadedFile {
  id: string;
  original_name: string;
  file_type: string;
  size_bytes: number;
  status: string;
  error_message?: string;
  created_at: string;
}

// Content endpoints
export const content = {
  list: (
    projectId: string,
    options: { selected?: boolean; chapterId?: string; limit?: number },
    token: string
  ) => {
    const params = new URLSearchParams();
    if (options.selected !== undefined)
      params.set('selected', String(options.selected));
    if (options.chapterId) params.set('chapter_id', options.chapterId);
    if (options.limit) params.set('limit', String(options.limit));

    return request<{ content: Content[]; total: number }>(
      `/api/projects/${projectId}/content?${params}`,
      { token }
    );
  },

  update: (
    projectId: string,
    contentId: string,
    updates: Partial<ContentUpdate>,
    token: string
  ) =>
    request<Content>(`/api/projects/${projectId}/content/${contentId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
      token,
    }),

  bulkUpdate: (
    projectId: string,
    operations: ContentUpdate[],
    token: string
  ) =>
    request<void>(`/api/projects/${projectId}/content/bulk`, {
      method: 'POST',
      body: JSON.stringify({ operations }),
      token,
    }),
};

// Processing endpoints
export const processing = {
  start: (
    projectId: string,
    stages: string[],
    token: string
  ) =>
    request<{ job_id: string; status: string; stages_queued: string[] }>(
      `/api/projects/${projectId}/process`,
      {
        method: 'POST',
        body: JSON.stringify({ stages }),
        token,
      }
    ),

  // Returns an EventSource for SSE progress updates
  progress: (projectId: string, token: string): EventSource => {
    const url = `${API_URL}/api/projects/${projectId}/progress`;
    return new EventSource(url, {
      // Note: EventSource doesn't support custom headers
      // We'll need to use a different approach for auth
    } as EventSourceInit);
  },
};

// Chapter endpoints
export const chapters = {
  list: (projectId: string, token: string) =>
    request<{ chapters: Chapter[] }>(`/api/projects/${projectId}/chapters`, {
      token,
    }),

  create: (projectId: string, chapters: ChapterInput[], token: string) =>
    request<{ chapters: Chapter[] }>(`/api/projects/${projectId}/chapters`, {
      method: 'POST',
      body: JSON.stringify({ chapters }),
      token,
    }),

  update: (
    projectId: string,
    chapterId: string,
    updates: Partial<ChapterInput>,
    token: string
  ) =>
    request<Chapter>(`/api/projects/${projectId}/chapters/${chapterId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
      token,
    }),

  delete: (projectId: string, chapterId: string, token: string) =>
    request<void>(`/api/projects/${projectId}/chapters/${chapterId}`, {
      method: 'DELETE',
      token,
    }),

  reorder: (projectId: string, chapterIds: string[], token: string) =>
    request<{ success: boolean }>(`/api/projects/${projectId}/chapters/reorder`, {
      method: 'POST',
      body: JSON.stringify({ chapter_ids: chapterIds }),
      token,
    }),
};

// Publishing endpoints
export const publishing = {
  publish: (
    projectId: string,
    options: { privacy: string; password?: string },
    token: string
  ) =>
    request<{ job_id: string; status: string; estimated_url: string }>(
      `/api/projects/${projectId}/publish`,
      {
        method: 'POST',
        body: JSON.stringify(options),
        token,
      }
    ),

  getSiteInfo: (projectId: string, token: string) =>
    request<SiteInfo>(`/api/projects/${projectId}/site`, { token }),
};

// Types
export interface Project {
  id: string;
  name: string;
  status: string;
  config?: Record<string, unknown>;
  stats?: {
    file_count: number;
    content_count: number;
    selected_count: number;
  };
  created_at: string;
  published_url?: string;
}

export interface Content {
  id: string;
  file_id: string;
  content_type: 'text' | 'image' | 'video' | 'audio';
  extracted_text?: string;
  thumbnail_url?: string;
  metadata?: {
    extracted_date?: string;
    people?: string[];
    places?: string[];
    emotional_tone?: string;
  };
  analysis?: {
    narrative_value: number;
    emotional_impact: number;
    uniqueness?: number;
    clarity?: number;
    historical_significance?: number;
  };
  is_selected: boolean;
  user_rating?: number;
  chapter_id?: string;
}

export interface ContentUpdate {
  id: string;
  is_selected?: boolean;
  user_rating?: number;
  chapter_id?: string;
  sort_order?: number;
}

export interface Chapter {
  id: string;
  title: string;
  intro_text?: string;
  sort_order: number;
  theme?: string;
  content_count?: number;
}

export interface ChapterInput {
  id?: string;
  title: string;
  sort_order?: number;
  intro_text?: string;
}

export interface SiteInfo {
  url: string;
  privacy: string;
  published_at: string;
  custom_domain?: string;
  analytics?: {
    views: number;
    unique_visitors: number;
  };
}

export { ApiError };
