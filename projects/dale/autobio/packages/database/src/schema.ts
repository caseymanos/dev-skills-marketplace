import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  settings: text('settings'), // JSON
});

// Projects table
export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    status: text('status').default('uploading'),
    config: text('config'), // JSON
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    published_url: text('published_url'),
  },
  (table) => ({
    userIdx: index('idx_projects_user').on(table.user_id),
    statusIdx: index('idx_projects_status').on(table.status),
  })
);

// Files table
export const files = sqliteTable(
  'files',
  {
    id: text('id').primaryKey(),
    project_id: text('project_id')
      .notNull()
      .references(() => projects.id),
    original_name: text('original_name').notNull(),
    r2_key: text('r2_key').notNull(),
    file_type: text('file_type').notNull(),
    size_bytes: integer('size_bytes'),
    status: text('status').default('pending'),
    error_message: text('error_message'),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    projectIdx: index('idx_files_project').on(table.project_id),
    statusIdx: index('idx_files_status').on(table.status),
  })
);

// Content table
export const content = sqliteTable(
  'content',
  {
    id: text('id').primaryKey(),
    file_id: text('file_id')
      .notNull()
      .references(() => files.id),
    project_id: text('project_id')
      .notNull()
      .references(() => projects.id),
    content_type: text('content_type').notNull(), // 'text' | 'image' | 'video' | 'audio'
    extracted_text: text('extracted_text'),
    metadata: text('metadata'), // JSON
    analysis: text('analysis'), // JSON
    is_selected: integer('is_selected', { mode: 'boolean' }).default(false),
    user_rating: integer('user_rating'), // -1, 0, or 1
    chapter_id: text('chapter_id').references(() => chapters.id),
    sort_order: integer('sort_order'),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    projectIdx: index('idx_content_project').on(table.project_id),
    selectedIdx: index('idx_content_selected').on(table.is_selected),
    chapterIdx: index('idx_content_chapter').on(table.chapter_id),
  })
);

// Chapters table
export const chapters = sqliteTable(
  'chapters',
  {
    id: text('id').primaryKey(),
    project_id: text('project_id')
      .notNull()
      .references(() => projects.id),
    title: text('title').notNull(),
    intro_text: text('intro_text'),
    sort_order: integer('sort_order'),
    theme: text('theme'),
  },
  (table) => ({
    projectIdx: index('idx_chapters_project').on(table.project_id),
  })
);

// Narratives table
export const narratives = sqliteTable(
  'narratives',
  {
    id: text('id').primaryKey(),
    content_id: text('content_id').references(() => content.id),
    chapter_id: text('chapter_id').references(() => chapters.id),
    project_id: text('project_id')
      .notNull()
      .references(() => projects.id),
    narrative_text: text('narrative_text'),
    version: integer('version').default(1),
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    projectIdx: index('idx_narratives_project').on(table.project_id),
    contentIdx: index('idx_narratives_content').on(table.content_id),
  })
);

// Jobs table
export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    project_id: text('project_id')
      .notNull()
      .references(() => projects.id),
    job_type: text('job_type').notNull(), // 'parse' | 'analyze' | 'curate' | 'write' | 'build' | 'publish'
    status: text('status').default('pending'), // 'pending' | 'running' | 'completed' | 'failed'
    progress: integer('progress').default(0),
    error: text('error'),
    metadata: text('metadata'), // JSON
    created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
    started_at: text('started_at'),
    completed_at: text('completed_at'),
  },
  (table) => ({
    projectIdx: index('idx_jobs_project').on(table.project_id),
    statusIdx: index('idx_jobs_status').on(table.status),
  })
);

// Type exports for use in the application
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;

export type Content = typeof content.$inferSelect;
export type NewContent = typeof content.$inferInsert;

export type Chapter = typeof chapters.$inferSelect;
export type NewChapter = typeof chapters.$inferInsert;

export type Narrative = typeof narratives.$inferSelect;
export type NewNarrative = typeof narratives.$inferInsert;

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
