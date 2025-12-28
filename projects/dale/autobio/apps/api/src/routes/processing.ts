import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../index';

export const processingRouter = new Hono<{ Bindings: Env }>();

// Validation schemas
const startProcessingSchema = z.object({
  stages: z.array(
    z.enum(['parse', 'analyze', 'curate', 'write', 'build'])
  ),
});

// POST /process - Start processing pipeline
processingRouter.post(
  '/process',
  zValidator('json', startProcessingSchema),
  async (c) => {
    const userId = c.get('userId');
    const projectId = c.req.param('projectId');
    const { stages } = c.req.valid('json');

    // Verify project ownership
    const project = await c.env.DB.prepare(
      'SELECT id, status FROM projects WHERE id = ? AND user_id = ?'
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

    // Create a job for tracking
    const jobId = `job_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

    await c.env.DB.prepare(`
      INSERT INTO jobs (id, project_id, job_type, status, metadata, created_at)
      VALUES (?, ?, ?, 'pending', ?, datetime('now'))
    `)
      .bind(
        jobId,
        projectId,
        stages.join(','),
        JSON.stringify({ stages, current_stage: stages[0] })
      )
      .run();

    // Queue the first stage
    const firstStage = stages[0];
    const queue = getQueueForStage(c.env, firstStage);

    if (queue) {
      await queue.send({
        type: `${firstStage}_project`,
        jobId,
        projectId,
        userId,
        stages,
        timestamp: Date.now(),
      });
    }

    // Update project status
    await c.env.DB.prepare('UPDATE projects SET status = ? WHERE id = ?')
      .bind(firstStage === 'parse' ? 'parsing' : firstStage + 'ing', projectId)
      .run();

    // Update job status
    await c.env.DB.prepare(
      'UPDATE jobs SET status = ?, started_at = datetime(\'now\') WHERE id = ?'
    )
      .bind('running', jobId)
      .run();

    return c.json(
      {
        job_id: jobId,
        status: 'running',
        stages_queued: stages,
      },
      202
    );
  }
);

// GET /progress - SSE stream for progress updates
processingRouter.get('/progress', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId')!;

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

  // Get Durable Object for this project's progress
  const progressId = c.env.PROGRESS_TRACKER.idFromName(projectId);
  const progressTracker = c.env.PROGRESS_TRACKER.get(progressId);

  // Forward to Durable Object for SSE
  const url = new URL(c.req.url);
  return progressTracker.fetch(
    new Request(`${url.origin}/sse`, {
      headers: c.req.raw.headers,
    })
  );
});

// GET /jobs - List jobs for a project
processingRouter.get('/jobs', async (c) => {
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

  const result = await c.env.DB.prepare(`
    SELECT
      id,
      job_type,
      status,
      progress,
      error,
      metadata,
      created_at,
      started_at,
      completed_at
    FROM jobs
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `)
    .bind(projectId)
    .all();

  return c.json({
    jobs: result.results.map((job) => ({
      id: job.id,
      job_type: job.job_type,
      status: job.status,
      progress: job.progress,
      error: job.error,
      metadata: job.metadata ? JSON.parse(job.metadata as string) : null,
      created_at: job.created_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
    })),
  });
});

// POST /reprocess/:fileId - Reprocess a specific file
processingRouter.post('/reprocess/:fileId', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');
  const fileId = c.req.param('fileId');

  // Verify file ownership
  const file = await c.env.DB.prepare(`
    SELECT f.id, f.file_type
    FROM files f
    JOIN projects p ON f.project_id = p.id
    WHERE f.id = ? AND f.project_id = ? AND p.user_id = ?
  `)
    .bind(fileId, projectId, userId)
    .first();

  if (!file) {
    return c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'File not found',
        },
      },
      404
    );
  }

  // Delete existing content for this file
  await c.env.DB.prepare('DELETE FROM content WHERE file_id = ?')
    .bind(fileId)
    .run();

  // Queue the file for parsing
  await c.env.PARSE_QUEUE.send({
    type: 'parse_file',
    fileId,
    projectId,
    userId,
    fileType: file.file_type,
    timestamp: Date.now(),
  });

  // Update file status
  await c.env.DB.prepare('UPDATE files SET status = ? WHERE id = ?')
    .bind('parsing', fileId)
    .run();

  return c.json({
    file_id: fileId,
    status: 'parsing',
    queued: true,
  });
});

// Helper to get queue for a stage
function getQueueForStage(
  env: Env,
  stage: string
): Queue | null {
  switch (stage) {
    case 'parse':
      return env.PARSE_QUEUE;
    case 'analyze':
      return env.ANALYZE_QUEUE;
    case 'write':
      return env.WRITE_QUEUE;
    case 'build':
      return env.BUILD_QUEUE;
    default:
      return null;
  }
}
