import { Hono } from 'hono';
import { SignJWT, jwtVerify } from 'jose';
import { createDb } from './db';
import type { AppEnv } from './types';
import { z } from 'zod';

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().optional(),
});

const app = new Hono<AppEnv>();

async function getJwtSecret(env: AppEnv['Bindings']) {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    // Surface a clear, actionable error instead of a cryptic Web Crypto
    // "HMAC key length (0)" failure when the secret isn't configured.
    throw new JwtSecretMissingError();
  }
  return new TextEncoder().encode(secret);
}

export class JwtSecretMissingError extends Error {
  constructor() {
    super('JWT_SECRET is not configured on the server');
    this.name = 'JwtSecretMissingError';
  }
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createToken(userId: string, email: string, secret: Uint8Array) {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(token: string, secret: Uint8Array) {
  try {
    const { payload } = await jwtVerify(token, secret, { clockTolerance: 60 });
    return { id: payload.sub as string, email: payload.email as string };
  } catch {
    return null;
  }
}

export async function authMiddleware(c: import('hono').Context<AppEnv>, next: import('hono').Next) {
  const header = c.req.header('Authorization');
  c.set('user', null);

  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    try {
      const secret = await getJwtSecret(c.env);
      const payload = await verifyToken(token, secret);
      if (payload) {
        c.set('user', payload);
      }
    } catch {
      // Missing/invalid JWT_SECRET → treat as unauthenticated rather than 500.
    }
  }

  await next();
}

// POST /auth/register
app.post('/register', async (c) => {
  const body = await c.req.json();
  const parsed = authSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const { email, password, name } = parsed.data;
  const db = createDb(c.env.DB);

  const existing = await db.queryOne('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) return c.json({ error: 'User already exists' }, 409);

  const userId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const passwordHash = await hashPassword(password);

  await db.prepare('INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(userId, email, name ?? null, passwordHash, now, now)
    .run();

  let token;
  try {
    const secret = await getJwtSecret(c.env);
    token = await createToken(userId, email, secret);
  } catch (e) {
    if (e instanceof JwtSecretMissingError) {
      return c.json({ error: 'Server auth is not configured (JWT_SECRET missing). Set it via `wrangler secret put JWT_SECRET`.' }, 503);
    }
    throw e;
  }

  return c.json({ token, user: { id: userId, email, name } });
});

// POST /auth/login
app.post('/login', async (c) => {
  const body = await c.req.json();
  const parsed = authSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const { email, password } = parsed.data;
  const db = createDb(c.env.DB);

  const user = await db.queryOne<{ id: string; email: string; name: string | null; password_hash: string }>(
    'SELECT id, email, name, password_hash FROM users WHERE email = ?',
    [email]
  );
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);

  const providedHash = await hashPassword(password);
  if (providedHash !== user.password_hash) return c.json({ error: 'Invalid credentials' }, 401);

  let token;
  try {
    const secret = await getJwtSecret(c.env);
    token = await createToken(user.id, user.email, secret);
  } catch (e) {
    if (e instanceof JwtSecretMissingError) {
      return c.json({ error: 'Server auth is not configured (JWT_SECRET missing). Set it via `wrangler secret put JWT_SECRET`.' }, 503);
    }
    throw e;
  }

  return c.json({ token, user });
});

// GET /auth/me
app.get('/me', authMiddleware, async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const db = createDb(c.env.DB);
  const me = await db.queryOne<{ id: string; email: string; name: string | null }>(
    'SELECT id, email, name FROM users WHERE id = ?',
    [user.id]
  );

  return c.json({ user: me });
});

export default app;

export { getJwtSecret };
