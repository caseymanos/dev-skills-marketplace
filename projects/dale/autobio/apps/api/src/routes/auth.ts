import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { createJWT } from '../middleware/auth';
import type { Env } from '../index';

export const authRouter = new Hono<{ Bindings: Env }>();

// Validation schemas
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const oauthCallbackSchema = z.object({
  provider: z.enum(['google', 'apple']),
  code: z.string(),
  redirectUri: z.string().url(),
});

// Simple password hashing for MVP (use bcrypt in production)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

// POST /auth/signup - Create new user
authRouter.post('/signup', zValidator('json', signupSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  // Check if user exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  )
    .bind(email)
    .first();

  if (existing) {
    return c.json(
      {
        error: {
          code: 'USER_EXISTS',
          message: 'A user with this email already exists',
        },
      },
      400
    );
  }

  // Create user
  const userId = `user_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(`
    INSERT INTO users (id, email, password_hash, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `)
    .bind(userId, email, passwordHash)
    .run();

  // Generate JWT
  const token = await createJWT(
    { sub: userId, email },
    c.env.JWT_SECRET,
    86400 * 7 // 7 days
  );

  return c.json(
    {
      user: {
        id: userId,
        email,
      },
      token,
    },
    201
  );
});

// POST /auth/login - Login existing user
authRouter.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  // Find user
  const user = await c.env.DB.prepare(
    'SELECT id, email, password_hash FROM users WHERE email = ?'
  )
    .bind(email)
    .first();

  if (!user) {
    return c.json(
      {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      },
      401
    );
  }

  // Verify password
  const passwordHash = await hashPassword(password);
  if (passwordHash !== user.password_hash) {
    return c.json(
      {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      },
      401
    );
  }

  // Generate JWT
  const token = await createJWT(
    { sub: user.id as string, email: user.email as string },
    c.env.JWT_SECRET,
    86400 * 7 // 7 days
  );

  return c.json({
    user: {
      id: user.id,
      email: user.email,
    },
    token,
  });
});

// GET /auth/me - Get current user (requires auth)
authRouter.get('/me', async (c) => {
  // This will be called after auth middleware
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');

  if (!userId) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
      },
      401
    );
  }

  return c.json({
    user: {
      id: userId,
      email: userEmail,
    },
  });
});

// Helper to find or create OAuth user
async function findOrCreateOAuthUser(
  db: D1Database,
  email: string,
  provider: string,
  providerId: string
): Promise<{ id: string; email: string }> {
  // Check if user exists
  let user = await db.prepare('SELECT id, email FROM users WHERE email = ?')
    .bind(email)
    .first();

  if (!user) {
    // Create new user
    const userId = `user_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    await db.prepare(`
      INSERT INTO users (id, email, password_hash, oauth_provider, oauth_id, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `)
      .bind(userId, email, null, provider, providerId)
      .run();

    user = { id: userId, email };
  }

  return { id: user.id as string, email: user.email as string };
}

// GET /auth/oauth/google - Get Google OAuth URL
authRouter.get('/oauth/google', async (c) => {
  const redirectUri = c.req.query('redirect_uri') || 'https://autobiography-web.pages.dev/auth/callback';
  const clientId = c.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return c.json({ error: { code: 'CONFIG_ERROR', message: 'Google OAuth not configured' } }, 500);
  }

  const state = crypto.randomUUID();
  const scope = encodeURIComponent('email profile');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&state=${state}` +
    `&access_type=offline` +
    `&prompt=consent`;

  return c.json({ url: authUrl, state });
});

// POST /auth/oauth/google/callback - Exchange Google code for token
authRouter.post('/oauth/google/callback', async (c) => {
  const { code, redirectUri } = await c.req.json();
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return c.json({ error: { code: 'CONFIG_ERROR', message: 'Google OAuth not configured' } }, 500);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json() as { access_token?: string; error?: string };
    if (!tokens.access_token) {
      return c.json({ error: { code: 'OAUTH_ERROR', message: tokens.error || 'Failed to get access token' } }, 400);
    }

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const userInfo = await userInfoResponse.json() as { id: string; email: string };
    if (!userInfo.email) {
      return c.json({ error: { code: 'OAUTH_ERROR', message: 'Failed to get user email' } }, 400);
    }

    // Find or create user
    const user = await findOrCreateOAuthUser(c.env.DB, userInfo.email, 'google', userInfo.id);

    // Generate JWT
    const token = await createJWT(
      { sub: user.id, email: user.email },
      c.env.JWT_SECRET,
      86400 * 7
    );

    return c.json({ user, token });
  } catch (error) {
    console.error('Google OAuth error:', error);
    return c.json({ error: { code: 'OAUTH_ERROR', message: 'OAuth authentication failed' } }, 500);
  }
});

// GET /auth/oauth/apple - Get Apple OAuth URL
authRouter.get('/oauth/apple', async (c) => {
  const redirectUri = c.req.query('redirect_uri') || 'https://autobiography-web.pages.dev/auth/callback';
  const clientId = c.env.APPLE_CLIENT_ID;

  if (!clientId) {
    return c.json({ error: { code: 'CONFIG_ERROR', message: 'Apple OAuth not configured' } }, 500);
  }

  const state = crypto.randomUUID();
  const scope = encodeURIComponent('email name');

  const authUrl = `https://appleid.apple.com/auth/authorize?` +
    `client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${scope}` +
    `&state=${state}` +
    `&response_mode=form_post`;

  return c.json({ url: authUrl, state });
});

// POST /auth/oauth/apple/callback - Exchange Apple code for token
authRouter.post('/oauth/apple/callback', async (c) => {
  const { code, redirectUri, idToken } = await c.req.json();
  const clientId = c.env.APPLE_CLIENT_ID;
  const clientSecret = c.env.APPLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return c.json({ error: { code: 'CONFIG_ERROR', message: 'Apple OAuth not configured' } }, 500);
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json() as { id_token?: string; error?: string };
    if (!tokens.id_token) {
      return c.json({ error: { code: 'OAUTH_ERROR', message: tokens.error || 'Failed to get tokens' } }, 400);
    }

    // Decode the ID token to get user info (simplified - should verify signature in production)
    const payload = JSON.parse(atob(tokens.id_token.split('.')[1])) as { sub: string; email: string };
    if (!payload.email) {
      return c.json({ error: { code: 'OAUTH_ERROR', message: 'Failed to get user email' } }, 400);
    }

    // Find or create user
    const user = await findOrCreateOAuthUser(c.env.DB, payload.email, 'apple', payload.sub);

    // Generate JWT
    const token = await createJWT(
      { sub: user.id, email: user.email },
      c.env.JWT_SECRET,
      86400 * 7
    );

    return c.json({ user, token });
  } catch (error) {
    console.error('Apple OAuth error:', error);
    return c.json({ error: { code: 'OAUTH_ERROR', message: 'OAuth authentication failed' } }, 500);
  }
});

// POST /auth/dev-token - Create a dev token (only in development)
authRouter.post('/dev-token', async (c) => {
  if (c.env.ENVIRONMENT === 'production') {
    return c.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: 'Dev tokens not available in production',
        },
      },
      403
    );
  }

  // Create or get dev user
  const devEmail = 'dev@autobio.local';
  let user = await c.env.DB.prepare(
    'SELECT id, email FROM users WHERE email = ?'
  )
    .bind(devEmail)
    .first();

  if (!user) {
    const userId = `user_dev_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
    await c.env.DB.prepare(`
      INSERT INTO users (id, email, password_hash, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `)
      .bind(userId, devEmail, 'dev-no-password')
      .run();

    user = { id: userId, email: devEmail };
  }

  // Generate JWT
  const token = await createJWT(
    { sub: user.id as string, email: user.email as string },
    c.env.JWT_SECRET,
    86400 * 30 // 30 days for dev
  );

  return c.json({
    user: {
      id: user.id,
      email: user.email,
    },
    token,
    message: 'Dev token created. Store this token for API calls.',
  });
});
