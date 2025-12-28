import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../index';

export const projectsRouter = new Hono<{ Bindings: Env }>();

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
});

// GET /api/projects - List user's projects
projectsRouter.get('/', async (c) => {
  const userId = c.get('userId');

  const projects = await c.env.DB.prepare(`
    SELECT
      p.*,
      COUNT(DISTINCT f.id) as file_count,
      COUNT(DISTINCT c.id) as content_count,
      COUNT(DISTINCT CASE WHEN c.is_selected = 1 THEN c.id END) as selected_count
    FROM projects p
    LEFT JOIN files f ON f.project_id = p.id
    LEFT JOIN content c ON c.project_id = p.id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `)
    .bind(userId)
    .all();

  return c.json({
    projects: projects.results.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      config: p.config ? JSON.parse(p.config as string) : null,
      stats: {
        file_count: p.file_count,
        content_count: p.content_count,
        selected_count: p.selected_count,
      },
      created_at: p.created_at,
      published_url: p.published_url,
    })),
  });
});

// POST /api/projects - Create a new project
projectsRouter.post('/', zValidator('json', createProjectSchema), async (c) => {
  const userId = c.get('userId');
  const { name } = c.req.valid('json');

  const projectId = `proj_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

  await c.env.DB.prepare(`
    INSERT INTO projects (id, user_id, name, status, created_at)
    VALUES (?, ?, ?, 'uploading', datetime('now'))
  `)
    .bind(projectId, userId, name)
    .run();

  return c.json(
    {
      id: projectId,
      name,
      status: 'uploading',
      created_at: new Date().toISOString(),
    },
    201
  );
});

// GET /api/projects/:id - Get project details
projectsRouter.get('/:id', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');

  const result = await c.env.DB.prepare(`
    SELECT
      p.*,
      COUNT(DISTINCT f.id) as file_count,
      COUNT(DISTINCT c.id) as content_count,
      COUNT(DISTINCT CASE WHEN c.is_selected = 1 THEN c.id END) as selected_count
    FROM projects p
    LEFT JOIN files f ON f.project_id = p.id
    LEFT JOIN content c ON c.project_id = p.id
    WHERE p.id = ? AND p.user_id = ?
    GROUP BY p.id
  `)
    .bind(projectId, userId)
    .first();

  if (!result) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      },
      404
    );
  }

  return c.json({
    id: result.id,
    name: result.name,
    status: result.status,
    config: result.config ? JSON.parse(result.config as string) : null,
    stats: {
      file_count: result.file_count,
      content_count: result.content_count,
      selected_count: result.selected_count,
    },
    created_at: result.created_at,
    published_url: result.published_url,
  });
});

// PATCH /api/projects/:id - Update project
projectsRouter.patch('/:id', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const body = await c.req.json();

  // Verify ownership
  const project = await c.env.DB.prepare(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?'
  )
    .bind(projectId, userId)
    .first();

  if (!project) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      },
      404
    );
  }

  // Build update query dynamically
  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.name) {
    updates.push('name = ?');
    values.push(body.name);
  }

  if (body.config) {
    updates.push('config = ?');
    values.push(JSON.stringify(body.config));
  }

  if (updates.length > 0) {
    values.push(projectId);
    await c.env.DB.prepare(
      `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`
    )
      .bind(...values)
      .run();
  }

  return c.json({ success: true });
});

// DELETE /api/projects/:id - Delete project
projectsRouter.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');

  // Verify ownership
  const project = await c.env.DB.prepare(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?'
  )
    .bind(projectId, userId)
    .first();

  if (!project) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
        },
      },
      404
    );
  }

  // Delete all related data (cascading)
  // In production, consider soft delete with 30-day retention
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM narratives WHERE project_id = ?').bind(projectId),
    c.env.DB.prepare('DELETE FROM content WHERE project_id = ?').bind(projectId),
    c.env.DB.prepare('DELETE FROM chapters WHERE project_id = ?').bind(projectId),
    c.env.DB.prepare('DELETE FROM files WHERE project_id = ?').bind(projectId),
    c.env.DB.prepare('DELETE FROM jobs WHERE project_id = ?').bind(projectId),
    c.env.DB.prepare('DELETE FROM projects WHERE id = ?').bind(projectId),
  ]);

  // TODO: Delete R2 files for this project
  // This should be done asynchronously via a queue

  return c.body(null, 204);
});
