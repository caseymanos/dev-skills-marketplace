import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { projectsRouter } from './routes/projects';
import { uploadRouter } from './routes/upload';
import { contentRouter } from './routes/content';
import { chaptersRouter } from './routes/chapters';
import { processingRouter } from './routes/processing';
import { publishingRouter } from './routes/publishing';
import { authRouter } from './routes/auth';
import { authMiddleware } from './middleware/auth';
import { ProgressTracker } from './durable-objects/progress-tracker';

// Export Durable Object class
export { ProgressTracker };

// Environment bindings type
export interface Env {
  // D1 Database
  DB: D1Database;
  // R2 Storage
  STORAGE: R2Bucket;
  // KV Cache
  CACHE: KVNamespace;
  // Queues
  PARSE_QUEUE: Queue;
  ANALYZE_QUEUE: Queue;
  WRITE_QUEUE: Queue;
  BUILD_QUEUE: Queue;
  // Durable Objects
  PROGRESS_TRACKER: DurableObjectNamespace;
  // Environment variables
  ENVIRONMENT: string;
  JWT_SECRET: string;
  CLAUDE_API_KEY: string;
  // OAuth credentials (optional)
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
}

// Create the Hono app with typed environment
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());

// Apply secure headers with custom config for iframe embedding
app.use('*', async (c, next) => {
  await next();

  // Allow iframe embedding for preview endpoint from allowed origins
  const path = new URL(c.req.url).pathname;
  if (path.endsWith('/preview')) {
    // Remove X-Frame-Options to allow iframe embedding
    // Content-Security-Policy frame-ancestors will control this instead
    c.res.headers.delete('X-Frame-Options');
    c.res.headers.set(
      'Content-Security-Policy',
      "frame-ancestors 'self' http://localhost:3000 https://autobio.app https://autobiography-web.pages.dev https://*.autobiography-web.pages.dev"
    );
  }
});

app.use('*', secureHeaders());
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow specific origins
      const allowedOrigins = [
        'http://localhost:3000',
        'https://autobio.app',
        'https://autobiography-web.pages.dev',
      ];
      if (allowedOrigins.includes(origin)) {
        return origin;
      }
      // Allow Cloudflare Pages preview deployments
      if (origin.endsWith('.autobiography-web.pages.dev')) {
        return origin;
      }
      return null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Health check endpoint (no auth required)
app.get('/health', (c) => {
  return c.json({ status: 'ok', environment: c.env.ENVIRONMENT });
});

// Auth routes (no auth required for login/signup)
app.route('/auth', authRouter);

// Apply auth middleware to all /api routes
app.use('/api/*', authMiddleware);

// Mount route modules
app.route('/api/projects', projectsRouter);
app.route('/api/projects/:projectId/upload', uploadRouter);
app.route('/api/projects/:projectId/content', contentRouter);
app.route('/api/projects/:projectId/chapters', chaptersRouter);
app.route('/api/projects/:projectId', processingRouter);
app.route('/api/projects/:projectId', publishingRouter);

// Error handling
app.onError((err, c) => {
  console.error('Unhandled error:', err);

  // Check if it's a known error type
  if (err instanceof Error && 'status' in err) {
    const httpError = err as Error & { status: number; code?: string };
    return c.json(
      {
        error: {
          code: httpError.code || 'ERROR',
          message: httpError.message,
        },
      },
      httpError.status as 400 | 401 | 403 | 404 | 500
    );
  }

  return c.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500
  );
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found',
      },
    },
    404
  );
});

export default app;
