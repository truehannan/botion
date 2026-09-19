import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware } from '../auth';
import type { AppEnv } from '../types';
import { z } from 'zod';

const app = new Hono<AppEnv>();

app.use('*', authMiddleware);

// GET /workspaces
app.get('/', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const db = createDb(c.env.DB);
  const workspaces = await db.query(
    `SELECT DISTINCT w.* FROM workspaces w
     LEFT JOIN pages p ON p.workspace_id = w.id
     LEFT JOIN page_permissions pp ON pp.page_id = p.id
     WHERE w.owner_id = ? OR pp.user_id = ?`,
    [user.id, user.id]
  );

  return c.json({ workspaces });
});

// POST /workspaces
app.post('/', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const schema = z.object({ name: z.string().min(1), slug: z.string().min(1) });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const { name, slug } = parsed.data;
  const db = createDb(c.env.DB);

  // Check slug uniqueness
  const existing = await db.queryOne('SELECT id FROM workspaces WHERE slug = ?', [slug]);
  if (existing) return c.json({ error: 'Slug already taken' }, 409);

  const wsId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.prepare('INSERT INTO workspaces (id, name, slug, owner_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(wsId, name, slug, user.id, now, now)
    .run();

  // Create a root page for the workspace
  const rootPageId = crypto.randomUUID();
  await db.prepare('INSERT INTO pages (id, workspace_id, title, is_folder, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(rootPageId, wsId, 'Home', 1, 0, now, now)
    .run();

  return c.json({ workspace: { id: wsId, name, slug, owner_id: user.id, created_at: now, updated_at: now } });
});

// GET /workspaces/:id
app.get('/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const db = createDb(c.env.DB);
  const workspace = await db.queryOne('SELECT * FROM workspaces WHERE id = ?', [c.req.param('id')]);
  if (!workspace) return c.json({ error: 'Not found' }, 404);

  return c.json({ workspace });
});

export default app;
