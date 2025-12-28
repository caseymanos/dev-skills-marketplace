import { Context, Next } from 'hono';
import type { Env } from '../index';

// Simple JWT validation for MVP
// In production, consider using jose or similar library
interface JWTPayload {
  sub: string; // user_id
  email: string;
  iat: number;
  exp: number;
}

// Custom context with user
declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
    userEmail: string;
  }
}

// Endpoints that can accept auth tokens via query parameter (for iframe/embed use)
const ALLOWED_QUERY_AUTH_ENDPOINTS = [
  '/preview', // Preview endpoint loaded in iframe
  '/progress', // SSE endpoint for progress updates
];

function isAllowedQueryAuthEndpoint(pathname: string): boolean {
  return ALLOWED_QUERY_AUTH_ENDPOINTS.some((endpoint) =>
    pathname.endsWith(endpoint)
  );
}

export async function authMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const authHeader = c.req.header('Authorization');

  // For iframe-loaded endpoints like preview, accept token from query param
  const url = new URL(c.req.url);
  const queryToken = url.searchParams.get('token');

  let token: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (queryToken && isAllowedQueryAuthEndpoint(url.pathname)) {
    // Only allow query param auth for specific endpoints
    token = queryToken;
  }

  if (!token) {
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        },
      },
      401
    );
  }

  try {
    // For MVP, we'll use a simple JWT verification
    // In production, use proper JWT library with secret validation
    const payload = await verifyJWT(token, c.env.JWT_SECRET);

    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return c.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Token has expired',
          },
        },
        401
      );
    }

    // Set user context
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email);

    await next();
  } catch (error) {
    console.error('Auth error:', error);
    return c.json(
      {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
        },
      },
      401
    );
  }
}

// Simple JWT verification (MVP)
// In production, replace with jose or similar
async function verifyJWT(token: string, secret: string): Promise<JWTPayload> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Verify signature using Web Crypto API
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureData = Uint8Array.from(
    atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  );

  const data = encoder.encode(`${headerB64}.${payloadB64}`);

  const isValid = await crypto.subtle.verify('HMAC', key, signatureData, data);

  if (!isValid) {
    throw new Error('Invalid signature');
  }

  // Decode payload
  const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(payloadJson) as JWTPayload;
}

// Helper to create JWT (for testing/auth endpoints)
export async function createJWT(
  payload: Omit<JWTPayload, 'iat' | 'exp'>,
  secret: string,
  expiresIn: number = 86400 // 24 hours
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const encoder = new TextEncoder();

  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const payloadB64 = btoa(JSON.stringify(fullPayload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${headerB64}.${payloadB64}`)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}
