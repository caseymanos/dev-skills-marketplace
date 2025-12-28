import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../index';

export const contentRouter = new Hono<{ Bindings: Env }>();

// Query params schema
const listContentSchema = z.object({
  selected: z.coerce.boolean().optional(),
  chapter_id: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// Update content schema
const updateContentSchema = z.object({
  is_selected: z.boolean().optional(),
  user_rating: z.number().min(-1).max(1).optional(), // -1 = thumbs down, 0 = neutral, 1 = thumbs up
  chapter_id: z.string().nullable().optional(),
  sort_order: z.number().optional(),
});

// Bulk update schema
const bulkUpdateSchema = z.object({
  operations: z.array(
    z.object({
      id: z.string(),
      is_selected: z.boolean().optional(),
      user_rating: z.number().optional(),
      chapter_id: z.string().nullable().optional(),
      sort_order: z.number().optional(),
    })
  ),
});

// GET / - List content for a project
contentRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');

  // Parse and validate query params
  const query = listContentSchema.parse({
    selected: c.req.query('selected'),
    chapter_id: c.req.query('chapter_id'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  });

  // Verify project ownership
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

  // Build query with filters
  let whereClause = 'c.project_id = ?';
  const params: unknown[] = [projectId];

  if (query.selected !== undefined) {
    whereClause += ' AND c.is_selected = ?';
    params.push(query.selected ? 1 : 0);
  }

  if (query.chapter_id) {
    whereClause += ' AND c.chapter_id = ?';
    params.push(query.chapter_id);
  }

  // Get total count
  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM content c WHERE ${whereClause}`
  )
    .bind(...params)
    .first();

  // Get content with pagination
  const contentResult = await c.env.DB.prepare(`
    SELECT
      c.id,
      c.file_id,
      c.content_type,
      c.extracted_text,
      c.metadata,
      c.analysis,
      c.is_selected,
      c.user_rating,
      c.chapter_id,
      c.sort_order,
      c.created_at,
      f.original_name as source_file
    FROM content c
    JOIN files f ON f.id = c.file_id
    WHERE ${whereClause}
    ORDER BY
      CASE WHEN c.chapter_id IS NOT NULL THEN c.sort_order ELSE 999999 END,
      json_extract(c.analysis, '$.narrative_value') DESC
    LIMIT ? OFFSET ?
  `)
    .bind(...params, query.limit, query.offset)
    .all();

  // Transform results
  const content = contentResult.results.map((row) => ({
    id: row.id,
    file_id: row.file_id,
    content_type: row.content_type,
    extracted_text: row.extracted_text
      ? (row.extracted_text as string).slice(0, 500) // Truncate for list view
      : null,
    thumbnail_url: row.content_type === 'image'
      ? `/api/projects/${projectId}/content/${row.id}/thumbnail`
      : null,
    metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
    analysis: row.analysis ? JSON.parse(row.analysis as string) : null,
    is_selected: Boolean(row.is_selected),
    user_rating: row.user_rating,
    chapter_id: row.chapter_id,
    sort_order: row.sort_order,
    source_file: row.source_file,
  }));

  return c.json({
    content,
    total: (countResult?.total as number) || 0,
    limit: query.limit,
    offset: query.offset,
  });
});

// GET /:contentId - Get single content item
contentRouter.get('/:contentId', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');
  const contentId = c.req.param('contentId');

  const result = await c.env.DB.prepare(`
    SELECT
      c.*,
      f.original_name as source_file,
      f.r2_key
    FROM content c
    JOIN files f ON f.id = c.file_id
    JOIN projects p ON p.id = c.project_id
    WHERE c.id = ? AND c.project_id = ? AND p.user_id = ?
  `)
    .bind(contentId, projectId, userId)
    .first();

  if (!result) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Content not found',
        },
      },
      404
    );
  }

  return c.json({
    id: result.id,
    file_id: result.file_id,
    content_type: result.content_type,
    extracted_text: result.extracted_text,
    metadata: result.metadata ? JSON.parse(result.metadata as string) : null,
    analysis: result.analysis ? JSON.parse(result.analysis as string) : null,
    is_selected: Boolean(result.is_selected),
    user_rating: result.user_rating,
    chapter_id: result.chapter_id,
    sort_order: result.sort_order,
    source_file: result.source_file,
    created_at: result.created_at,
  });
});

// PATCH /:contentId - Update content
contentRouter.patch(
  '/:contentId',
  zValidator('json', updateContentSchema),
  async (c) => {
    const userId = c.get('userId');
    const projectId = c.req.param('projectId');
    const contentId = c.req.param('contentId');
    const updates = c.req.valid('json');

    // Verify content ownership
    const content = await c.env.DB.prepare(`
      SELECT c.id
      FROM content c
      JOIN projects p ON p.id = c.project_id
      WHERE c.id = ? AND c.project_id = ? AND p.user_id = ?
    `)
      .bind(contentId, projectId, userId)
      .first();

    if (!content) {
      return c.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Content not found',
          },
        },
        404
      );
    }

    // Build update query
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.is_selected !== undefined) {
      setClauses.push('is_selected = ?');
      values.push(updates.is_selected ? 1 : 0);
    }

    if (updates.user_rating !== undefined) {
      setClauses.push('user_rating = ?');
      values.push(updates.user_rating);
    }

    if (updates.chapter_id !== undefined) {
      setClauses.push('chapter_id = ?');
      values.push(updates.chapter_id);
    }

    if (updates.sort_order !== undefined) {
      setClauses.push('sort_order = ?');
      values.push(updates.sort_order);
    }

    if (setClauses.length > 0) {
      values.push(contentId);
      await c.env.DB.prepare(
        `UPDATE content SET ${setClauses.join(', ')} WHERE id = ?`
      )
        .bind(...values)
        .run();
    }

    return c.json({ success: true, id: contentId });
  }
);

// POST /bulk - Bulk update content
contentRouter.post('/bulk', zValidator('json', bulkUpdateSchema), async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');
  const { operations } = c.req.valid('json');

  // Verify project ownership
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

  // Execute updates in a batch
  const statements = operations.map((op) => {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (op.is_selected !== undefined) {
      setClauses.push('is_selected = ?');
      values.push(op.is_selected ? 1 : 0);
    }

    if (op.user_rating !== undefined) {
      setClauses.push('user_rating = ?');
      values.push(op.user_rating);
    }

    if (op.chapter_id !== undefined) {
      setClauses.push('chapter_id = ?');
      values.push(op.chapter_id);
    }

    if (op.sort_order !== undefined) {
      setClauses.push('sort_order = ?');
      values.push(op.sort_order);
    }

    values.push(op.id, projectId);
    return c.env.DB.prepare(
      `UPDATE content SET ${setClauses.join(', ')} WHERE id = ? AND project_id = ?`
    ).bind(...values);
  });

  await c.env.DB.batch(statements);

  return c.json({ success: true, updated: operations.length });
});

// GET /:contentId/thumbnail - Get content thumbnail (for images)
contentRouter.get('/:contentId/thumbnail', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');
  const contentId = c.req.param('contentId');

  const result = await c.env.DB.prepare(`
    SELECT f.r2_key, c.content_type
    FROM content c
    JOIN files f ON f.id = c.file_id
    JOIN projects p ON p.id = c.project_id
    WHERE c.id = ? AND c.project_id = ? AND p.user_id = ?
  `)
    .bind(contentId, projectId, userId)
    .first();

  if (!result || result.content_type !== 'image') {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Image not found',
        },
      },
      404
    );
  }

  // Fetch from R2 and return
  const object = await c.env.STORAGE.get(result.r2_key as string);
  if (!object) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Image file not found',
        },
      },
      404
    );
  }

  // Return image with Cloudflare Image Resizing headers
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000',
      // Use Cloudflare Image Resizing via cf-image-resizing worker binding
      // For MVP, return full image - implement resizing later
    },
  });
});
