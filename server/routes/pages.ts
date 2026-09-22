import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware } from '../auth';
import type { AppEnv } from '../types';
import { z } from 'zod';

const app = new Hono<AppEnv>();

app.use('*', authMiddleware);

// GET /pages?workspace_id=...&parent_id=...
app.get('/', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const workspaceId = c.req.query('workspace_id');
  const parentId = c.req.query('parent_id');
  if (!workspaceId) return c.json({ error: 'Missing workspace_id' }, 400);

  const db = createDb(c.env.DB);
  let sql = 'SELECT * FROM pages WHERE workspace_id = ?';
  const params: unknown[] = [workspaceId];

  if (parentId !== undefined) {
    sql += ' AND parent_id = ?';
    params.push(parentId === 'null' ? null : parentId);
  } else {
    sql += ' AND parent_id IS NULL';
  }

  sql += ' ORDER BY sort_order ASC, created_at ASC';
  const pages = await db.query(sql, params);
  return c.json({ pages });
});

// GET /pages/:id
app.get('/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const db = createDb(c.env.DB);
  const page = await db.queryOne('SELECT * FROM pages WHERE id = ?', [c.req.param('id')]);
  if (!page) return c.json({ error: 'Not found' }, 404);

  return c.json({ page });
});

// POST /pages
app.post('/', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const schema = z.object({
    workspace_id: z.string(),
    parent_id: z.string().nullable().optional(),
    title: z.string().default('Untitled'),
    is_folder: z.boolean().default(false),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const { workspace_id, parent_id, title, is_folder } = parsed.data;
  const db = createDb(c.env.DB);
  const now = Math.floor(Date.now() / 1000);
  const pageId = crypto.randomUUID();

  await db.prepare(
    'INSERT INTO pages (id, workspace_id, parent_id, title, is_folder, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(pageId, workspace_id, parent_id ?? null, title, is_folder ? 1 : 0, 0, now, now)
    .run();

  // Add owner permission
  await db.prepare('INSERT INTO page_permissions (id, page_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), pageId, user.id, 'owner', now)
    .run();

  // Queue for AI indexing
  try {
    await c.env.PAGE_SAVE_QUEUE.send({ pageId, workspaceId: workspace_id, title, createdAt: now });
  } catch {
    // Queue may not be configured yet, ignore
  }

  return c.json({ page: { id: pageId, workspace_id, parent_id, title, is_folder, sort_order: 0, created_at: now, updated_at: now } });
});

// PATCH /pages/:id
app.patch('/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const db = createDb(c.env.DB);
  const pageId = c.req.param('id');

  const perm = await db.queryOne(
    'SELECT role FROM page_permissions WHERE page_id = ? AND user_id = ? AND role IN (?, ?)',
    [pageId, user.id, 'owner', 'editor']
  );
  if (!perm) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json();
  const now = Math.floor(Date.now() / 1000);

  const sets: string[] = [];
  const params: unknown[] = [];

  if (body.title !== undefined) { sets.push('title = ?'); params.push(body.title); }
  if (body.parent_id !== undefined) { sets.push('parent_id = ?'); params.push(body.parent_id); }
  if (body.icon !== undefined) { sets.push('icon = ?'); params.push(body.icon); }
  if (body.cover_image !== undefined) { sets.push('cover_image = ?'); params.push(body.cover_image); }
  if (body.sort_order !== undefined) { sets.push('sort_order = ?'); params.push(body.sort_order); }

  if (sets.length === 0) return c.json({ error: 'No fields to update' }, 400);

  sets.push('updated_at = ?');
  params.push(now);
  params.push(c.req.param('id'));

  const sql = `UPDATE pages SET ${sets.join(', ')} WHERE id = ?`;
  await db.prepare(sql).bind(...params).run();

  const page = await db.queryOne('SELECT * FROM pages WHERE id = ?', [c.req.param('id')]);

  // Queue for AI indexing
  if (page) {
    try {
      await c.env.PAGE_SAVE_QUEUE.send({ pageId: page.id, workspaceId: page.workspace_id, title: page.title, updatedAt: now });
    } catch { /* ignore */ }
  }

  return c.json({ page });
});

// DELETE /pages/:id
app.delete('/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const db = createDb(c.env.DB);
  const pageId = c.req.param('id');

  // Check permission
  const perm = await db.queryOne(
    'SELECT role FROM page_permissions WHERE page_id = ? AND user_id = ? AND role IN (?, ?)',
    [pageId, user.id, 'owner', 'editor']
  );
  if (!perm) return c.json({ error: 'Forbidden' }, 403);

  await db.prepare('DELETE FROM pages WHERE id = ?').bind(pageId).run();
  await db.prepare('DELETE FROM document_states WHERE page_id = ?').bind(pageId).run();

  return c.json({ success: true });
});

// Real-time WebSocket sync was backed by a Durable Object, which has been
// removed. Editing now persists via the REST endpoint `POST /sync/:pageId`
// (debounced auto-save). This route is kept only to return a clear signal to
// any old client that still tries to open a WebSocket here.
app.get('/:id/sync', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return c.json(
    { error: 'Realtime WebSocket sync is disabled; use REST sync at POST /sync/:pageId' },
    426 // Upgrade Required — signals the WS upgrade path is unavailable
  );
});

export default app;
