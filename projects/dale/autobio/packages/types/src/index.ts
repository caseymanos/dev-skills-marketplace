// Shared types for Autobiography Builder

// ============================================
// User Types
// ============================================

export interface User {
  id: string;
  email: string;
  created_at: string;
  settings?: UserSettings;
}

export interface UserSettings {
  default_theme: string;
  privacy_default: 'public' | 'unlisted' | 'password';
  notification_email: boolean;
}

// ============================================
// Project Types
// ============================================

export type ProjectStatus =
  | 'uploading'
  | 'parsing'
  | 'analyzing'
  | 'curating'
  | 'writing'
  | 'building'
  | 'published';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  status: ProjectStatus;
  config?: ProjectConfig;
  created_at: string;
  published_url?: string;
}

export interface ProjectConfig {
  theme: string;
  privacy: 'public' | 'unlisted' | 'password';
  password_hash?: string;
  custom_domain?: string;
}

export interface ProjectWithStats extends Project {
  stats: {
    file_count: number;
    content_count: number;
    selected_count: number;
  };
}

// ============================================
// File Types
// ============================================

export type FileStatus = 'pending' | 'uploading' | 'uploaded' | 'parsing' | 'parsed' | 'failed';

export interface ProjectFile {
  id: string;
  project_id: string;
  original_name: string;
  r2_key: string;
  file_type: string;
  size_bytes: number;
  status: FileStatus;
  error_message?: string;
  created_at: string;
}

// ============================================
// Content Types
// ============================================

export type ContentType = 'text' | 'image' | 'video' | 'audio';

export interface Content {
  id: string;
  file_id: string;
  project_id: string;
  content_type: ContentType;
  extracted_text?: string;
  metadata?: ContentMetadata;
  analysis?: ContentAnalysis;
  is_selected: boolean;
  user_rating?: number; // -1, 0, or 1
  chapter_id?: string;
  sort_order?: number;
  created_at: string;
}

export interface ContentMetadata {
  extracted_date?: string;
  people?: string[];
  places?: string[];
  events?: string[];
  emotional_tone?: string;
  confidence_score?: number;
}

export interface ContentAnalysis {
  narrative_value: number; // 1-10
  emotional_impact: number; // 1-10
  uniqueness: number; // 1-10
  clarity: number; // 1-10
  historical_significance: number; // 1-10
  themes?: string[];
  timeline_placement?: string;
  connections?: string[];
  suggested_chapter?: string;
}

export interface ContentWithNarrative extends Content {
  narrative_text?: string;
  source_file?: string;
}

// ============================================
// Chapter Types
// ============================================

export interface Chapter {
  id: string;
  project_id: string;
  title: string;
  intro_text?: string;
  sort_order: number;
  theme?: string;
}

export interface ChapterWithCount extends Chapter {
  content_count: number;
}

// ============================================
// Narrative Types
// ============================================

export interface Narrative {
  id: string;
  content_id?: string;
  chapter_id?: string;
  project_id: string;
  narrative_text: string;
  version: number;
  created_at: string;
}

// ============================================
// Job Types
// ============================================

export type JobType = 'parse' | 'analyze' | 'curate' | 'write' | 'build' | 'publish';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  project_id: string;
  job_type: JobType;
  status: JobStatus;
  progress: number;
  error?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

// ============================================
// API Types
// ============================================

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================
// Queue Message Types
// ============================================

export interface ParseFileMessage {
  type: 'parse_file';
  fileId: string;
  projectId: string;
  userId: string;
  fileType: string;
  timestamp: number;
}

export interface AnalyzeContentMessage {
  type: 'analyze_content';
  contentId: string;
  projectId: string;
  userId: string;
  timestamp: number;
}

export interface AnalyzeProjectMessage {
  type: 'analyze_project';
  jobId: string;
  projectId: string;
  userId: string;
  stages: string[];
  timestamp: number;
}

export interface WriteNarrativeMessage {
  type: 'write_narrative';
  contentId: string;
  chapterId?: string;
  projectId: string;
  userId: string;
  timestamp: number;
}

export interface WriteProjectMessage {
  type: 'write_project';
  jobId: string;
  projectId: string;
  userId: string;
  stages: string[];
  timestamp: number;
}

export interface BuildSiteMessage {
  type: 'build_and_publish';
  jobId: string;
  projectId: string;
  userId: string;
  config: {
    privacy: string;
    passwordHash?: string;
  };
  timestamp: number;
}

export type QueueMessage =
  | ParseFileMessage
  | AnalyzeContentMessage
  | AnalyzeProjectMessage
  | WriteNarrativeMessage
  | WriteProjectMessage
  | BuildSiteMessage;

// ============================================
// AI Agent Types
// ============================================

export interface ParsedContent {
  content: string;
  content_type: ContentType;
  extracted_date?: string;
  confidence_score: number;
  entities: {
    people: string[];
    places: string[];
    events: string[];
  };
  emotional_tone?: string;
  source_context: {
    folder_path?: string;
    filename: string;
  };
}

export interface AnalysisResult {
  content_id: string;
  scores: {
    narrative_value: number;
    emotional_impact: number;
    uniqueness: number;
    clarity: number;
    historical_significance: number;
  };
  timeline_placement?: {
    estimated_date?: string;
    life_phase?: string;
    confidence: number;
  };
  themes: string[];
  connections: string[];
  suggested_chapter?: string;
}

export interface CurationResult {
  selected_content: string[];
  chapter_structure: Array<{
    title: string;
    theme: string;
    content_ids: string[];
    suggested_intro?: string;
  }>;
  identified_gaps: Array<{
    period: string;
    suggestion: string;
  }>;
  removed_duplicates: Array<{
    kept: string;
    removed: string;
    reason: string;
  }>;
}

export interface NarrativeResult {
  chapter_id?: string;
  content_id?: string;
  title?: string;
  intro_narrative?: string;
  content_narratives?: Array<{
    content_id: string;
    narrative: string;
    caption?: string;
  }>;
  transition_to_next?: string;
}

// ============================================
// Site Generation Types
// ============================================

export interface SiteConfig {
  projectName: string;
  theme: string;
  privacy: 'public' | 'unlisted' | 'password';
  chapters: ChapterWithContent[];
}

export interface ChapterWithContent extends Chapter {
  content: ContentWithNarrative[];
}

export interface GeneratedSite {
  html: string;
  css: string;
  assets: Array<{
    path: string;
    key: string; // R2 key
  }>;
}
