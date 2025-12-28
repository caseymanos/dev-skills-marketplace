-- Autobiography Builder - Initial Database Schema
-- D1 SQLite Database

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  settings TEXT -- JSON: {default_theme, privacy_default, notification_email}
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'uploading',
  config TEXT, -- JSON: {theme, privacy, password_hash, custom_domain}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  published_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Files table
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  original_name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  file_type TEXT NOT NULL,
  size_bytes INTEGER,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);

-- Chapters table (created before content due to foreign key)
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  intro_text TEXT,
  sort_order INTEGER,
  theme TEXT
);

CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id);

-- Content table
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  content_type TEXT NOT NULL, -- 'text' | 'image' | 'video' | 'audio'
  extracted_text TEXT,
  metadata TEXT, -- JSON: {extracted_date, people[], places[], events[], emotional_tone, confidence_score}
  analysis TEXT, -- JSON: {narrative_value, emotional_impact, uniqueness, clarity, historical_significance, themes[], connections[], suggested_chapter}
  is_selected INTEGER DEFAULT 0,
  user_rating INTEGER, -- -1, 0, or 1
  chapter_id TEXT REFERENCES chapters(id),
  sort_order INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_project ON content(project_id);
CREATE INDEX IF NOT EXISTS idx_content_selected ON content(is_selected);
CREATE INDEX IF NOT EXISTS idx_content_chapter ON content(chapter_id);

-- Narratives table
CREATE TABLE IF NOT EXISTS narratives (
  id TEXT PRIMARY KEY,
  content_id TEXT REFERENCES content(id),
  chapter_id TEXT REFERENCES chapters(id),
  project_id TEXT NOT NULL REFERENCES projects(id),
  narrative_text TEXT,
  version INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_narratives_project ON narratives(project_id);
CREATE INDEX IF NOT EXISTS idx_narratives_content ON narratives(content_id);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  job_type TEXT NOT NULL, -- 'parse' | 'analyze' | 'curate' | 'write' | 'build' | 'publish'
  status TEXT DEFAULT 'pending', -- 'pending' | 'running' | 'completed' | 'failed'
  progress INTEGER DEFAULT 0,
  error TEXT,
  metadata TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_jobs_project ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
