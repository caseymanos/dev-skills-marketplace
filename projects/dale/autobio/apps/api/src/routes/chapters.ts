import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../index';

export const chaptersRouter = new Hono<{ Bindings: Env }>();

// Validation schemas
const createChaptersSchema = z.object({
  chapters: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string().min(1).max(200),
      sort_order: z.number().optional(),
      intro_text: z.string().optional(),
      theme: z.string().optional(),
    })
  ),
});

const updateChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  intro_text: z.string().optional(),
  sort_order: z.number().optional(),
  theme: z.string().optional(),
});

// GET / - List chapters for a project
chaptersRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');

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

  // Get chapters with content counts
  const result = await c.env.DB.prepare(`
    SELECT
      ch.id,
      ch.title,
      ch.intro_text,
      ch.sort_order,
      ch.theme,
      COUNT(c.id) as content_count
    FROM chapters ch
    LEFT JOIN content c ON c.chapter_id = ch.id AND c.is_selected = 1
    WHERE ch.project_id = ?
    GROUP BY ch.id
    ORDER BY ch.sort_order ASC
  `)
    .bind(projectId)
    .all();

  return c.json({
    chapters: result.results.map((ch) => ({
      id: ch.id,
      title: ch.title,
      intro_text: ch.intro_text,
      sort_order: ch.sort_order,
      theme: ch.theme,
      content_count: ch.content_count,
    })),
  });
});

// POST / - Create or update chapters (upsert)
chaptersRouter.post(
  '/',
  zValidator('json', createChaptersSchema),
  async (c) => {
    const userId = c.get('userId');
    const projectId = c.req.param('projectId');
    const { chapters } = c.req.valid('json');

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

    // Get existing chapters to determine sort order
    const existing = await c.env.DB.prepare(
      'SELECT MAX(sort_order) as max_order FROM chapters WHERE project_id = ?'
    )
      .bind(projectId)
      .first();

    let nextOrder = ((existing?.max_order as number) || 0) + 1;

    // Prepare batch statements
    const statements = chapters.map((ch) => {
      const chapterId =
        ch.id || `ch_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
      const sortOrder = ch.sort_order ?? nextOrder++;

      // Upsert: insert or update on conflict
      return c.env.DB.prepare(`
        INSERT INTO chapters (id, project_id, title, intro_text, sort_order, theme)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          intro_text = COALESCE(excluded.intro_text, intro_text),
          sort_order = excluded.sort_order,
          theme = COALESCE(excluded.theme, theme)
      `).bind(
        chapterId,
        projectId,
        ch.title,
        ch.intro_text || null,
        sortOrder,
        ch.theme || null
      );
    });

    await c.env.DB.batch(statements);

    // Return updated chapter list
    const result = await c.env.DB.prepare(`
      SELECT
        ch.id,
        ch.title,
        ch.intro_text,
        ch.sort_order,
        ch.theme,
        COUNT(c.id) as content_count
      FROM chapters ch
      LEFT JOIN content c ON c.chapter_id = ch.id AND c.is_selected = 1
      WHERE ch.project_id = ?
      GROUP BY ch.id
      ORDER BY ch.sort_order ASC
    `)
      .bind(projectId)
      .all();

    return c.json({
      chapters: result.results.map((ch) => ({
        id: ch.id,
        title: ch.title,
        intro_text: ch.intro_text,
        sort_order: ch.sort_order,
        theme: ch.theme,
        content_count: ch.content_count,
      })),
    });
  }
);

// PATCH /:chapterId - Update a single chapter
chaptersRouter.patch(
  '/:chapterId',
  zValidator('json', updateChapterSchema),
  async (c) => {
    const userId = c.get('userId');
    const projectId = c.req.param('projectId');
    const chapterId = c.req.param('chapterId');
    const updates = c.req.valid('json');

    // Verify chapter ownership
    const chapter = await c.env.DB.prepare(`
      SELECT ch.id
      FROM chapters ch
      JOIN projects p ON p.id = ch.project_id
      WHERE ch.id = ? AND ch.project_id = ? AND p.user_id = ?
    `)
      .bind(chapterId, projectId, userId)
      .first();

    if (!chapter) {
      return c.json(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'Chapter not found',
          },
        },
        404
      );
    }

    // Build update query
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.title !== undefined) {
      setClauses.push('title = ?');
      values.push(updates.title);
    }

    if (updates.intro_text !== undefined) {
      setClauses.push('intro_text = ?');
      values.push(updates.intro_text);
    }

    if (updates.sort_order !== undefined) {
      setClauses.push('sort_order = ?');
      values.push(updates.sort_order);
    }

    if (updates.theme !== undefined) {
      setClauses.push('theme = ?');
      values.push(updates.theme);
    }

    if (setClauses.length > 0) {
      values.push(chapterId);
      await c.env.DB.prepare(
        `UPDATE chapters SET ${setClauses.join(', ')} WHERE id = ?`
      )
        .bind(...values)
        .run();
    }

    // Return updated chapter
    const result = await c.env.DB.prepare(`
      SELECT
        ch.id,
        ch.title,
        ch.intro_text,
        ch.sort_order,
        ch.theme,
        COUNT(c.id) as content_count
      FROM chapters ch
      LEFT JOIN content c ON c.chapter_id = ch.id AND c.is_selected = 1
      WHERE ch.id = ?
      GROUP BY ch.id
    `)
      .bind(chapterId)
      .first();

    return c.json({
      id: result?.id,
      title: result?.title,
      intro_text: result?.intro_text,
      sort_order: result?.sort_order,
      theme: result?.theme,
      content_count: result?.content_count,
    });
  }
);

// DELETE /:chapterId - Delete a chapter
chaptersRouter.delete('/:chapterId', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');
  const chapterId = c.req.param('chapterId');

  // Verify chapter ownership
  const chapter = await c.env.DB.prepare(`
    SELECT ch.id
    FROM chapters ch
    JOIN projects p ON p.id = ch.project_id
    WHERE ch.id = ? AND ch.project_id = ? AND p.user_id = ?
  `)
    .bind(chapterId, projectId, userId)
    .first();

  if (!chapter) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Chapter not found',
        },
      },
      404
    );
  }

  // Unassign content from this chapter, then delete
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE content SET chapter_id = NULL WHERE chapter_id = ?').bind(
      chapterId
    ),
    c.env.DB.prepare('DELETE FROM chapters WHERE id = ?').bind(chapterId),
  ]);

  return c.body(null, 204);
});

// POST /reorder - Reorder chapters
chaptersRouter.post('/reorder', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');
  const body = await c.req.json<{ chapter_ids: string[] }>();

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

  // Update sort_order for each chapter
  const statements = body.chapter_ids.map((chapterId, index) =>
    c.env.DB.prepare(
      'UPDATE chapters SET sort_order = ? WHERE id = ? AND project_id = ?'
    ).bind(index + 1, chapterId, projectId)
  );

  await c.env.DB.batch(statements);

  return c.json({ success: true });
});
