import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Env } from '../index';

export const uploadRouter = new Hono<{ Bindings: Env }>();

// Allowed file types for MVP
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/rtf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/heic',
  'application/zip',
]);

// Max file sizes
const MAX_SINGLE_FILE = 500 * 1024 * 1024; // 500MB
const MAX_ZIP_FILE = 5 * 1024 * 1024 * 1024; // 5GB

// Validation schemas
const getUploadUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  content_type: z.string().refine((type) => ALLOWED_TYPES.has(type), {
    message: 'Unsupported file type',
  }),
  size_bytes: z.number().positive(),
});

const completeUploadSchema = z.object({
  file_id: z.string().min(1),
});

// GET / - List files for a project
uploadRouter.get('/', async (c) => {
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

  // Get files for project
  const files = await c.env.DB.prepare(`
    SELECT id, original_name, file_type, size_bytes, status, error_message, created_at
    FROM files
    WHERE project_id = ?
    ORDER BY created_at DESC
  `)
    .bind(projectId)
    .all();

  return c.json({
    files: files.results,
  });
});

// POST / - Get presigned upload URL
uploadRouter.post('/', zValidator('json', getUploadUrlSchema), async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');
  const { filename, content_type, size_bytes } = c.req.valid('json');

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

  // Check file size limits
  const maxSize = content_type === 'application/zip' ? MAX_ZIP_FILE : MAX_SINGLE_FILE;
  if (size_bytes > maxSize) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'File size exceeds maximum allowed',
          details: {
            max_size_bytes: maxSize,
            provided_size_bytes: size_bytes,
          },
        },
      },
      400
    );
  }

  // Generate file ID and R2 key
  const fileId = `file_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const r2Key = `users/${userId}/uploads/${projectId}/${fileId}/${filename}`;

  // Insert file record
  await c.env.DB.prepare(`
    INSERT INTO files (id, project_id, original_name, r2_key, file_type, size_bytes, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
  `)
    .bind(fileId, projectId, filename, r2Key, content_type, size_bytes)
    .run();

  // For R2, we need to use the Workers API to generate presigned URLs
  // R2 presigned URLs require the @aws-sdk/s3-request-presigner
  // For MVP, we'll use a direct upload approach via the worker

  // Generate a signed upload token that expires in 15 minutes
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const uploadToken = await generateUploadToken(
    fileId,
    r2Key,
    c.env.JWT_SECRET
  );

  return c.json({
    file_id: fileId,
    // For MVP, use worker-proxied upload
    upload_url: `/api/projects/${projectId}/upload/${fileId}/data`,
    upload_token: uploadToken,
    expires_at: expiresAt.toISOString(),
  });
});

// PUT /:fileId/data - Direct file upload (worker-proxied)
uploadRouter.put('/:fileId/data', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId')!;
  const fileId = c.req.param('fileId')!

  // Verify file ownership and get r2_key
  const file = await c.env.DB.prepare(`
    SELECT f.id, f.r2_key, f.file_type, f.size_bytes
    FROM files f
    JOIN projects p ON p.id = f.project_id
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

  // Get request body as stream
  const body = c.req.raw.body;
  if (!body) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No file data provided',
        },
      },
      400
    );
  }

  // Upload to R2
  try {
    await c.env.STORAGE.put(file.r2_key as string, body, {
      httpMetadata: {
        contentType: file.file_type as string,
      },
      customMetadata: {
        projectId,
        fileId,
        userId,
      },
    });

    // Update file status
    await c.env.DB.prepare(
      'UPDATE files SET status = ? WHERE id = ?'
    )
      .bind('uploaded', fileId)
      .run();

    return c.json({
      file_id: fileId,
      status: 'uploaded',
    });
  } catch (error) {
    console.error('R2 upload error:', error);
    return c.json(
      {
        error: {
          code: 'UPLOAD_ERROR',
          message: 'Failed to upload file',
        },
      },
      500
    );
  }
});

// POST /complete - Notify upload complete and start processing
uploadRouter.post('/complete', zValidator('json', completeUploadSchema), async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('projectId');
  const { file_id } = c.req.valid('json');

  // Verify file exists and is uploaded
  const file = await c.env.DB.prepare(`
    SELECT f.id, f.status, f.file_type
    FROM files f
    JOIN projects p ON p.id = f.project_id
    WHERE f.id = ? AND f.project_id = ? AND p.user_id = ?
  `)
    .bind(file_id, projectId, userId)
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

  if (file.status !== 'uploaded') {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'File upload not complete',
          details: {
            current_status: file.status,
          },
        },
      },
      400
    );
  }

  // Queue the file for parsing
  await c.env.PARSE_QUEUE.send({
    type: 'parse_file',
    fileId: file_id,
    projectId,
    userId,
    fileType: file.file_type,
    timestamp: Date.now(),
  });

  // Update file status
  await c.env.DB.prepare(
    'UPDATE files SET status = ? WHERE id = ?'
  )
    .bind('parsing', file_id)
    .run();

  return c.json({
    file_id,
    status: 'parsing',
    queued: true,
  });
});

// Helper to generate upload token
async function generateUploadToken(
  fileId: string,
  r2Key: string,
  secret: string
): Promise<string> {
  const payload = {
    fileId,
    r2Key,
    exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
  };

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const data = encoder.encode(JSON.stringify(payload));
  const signature = await crypto.subtle.sign('HMAC', key, data);

  return `${btoa(JSON.stringify(payload))}.${btoa(
    String.fromCharCode(...new Uint8Array(signature))
  )}`;
}
