import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware } from '../auth';
import type { AppEnv } from '../types';
import { z } from 'zod';

const app = new Hono<AppEnv>();
app.use('*', authMiddleware);

// GET /databases?parent_page_id=...
app.get('/', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const parentId = c.req.query('parent_page_id');
  if (!parentId) return c.json({ error: 'Missing parent_page_id' }, 400);

  const db = createDb(c.env.DB);
  const dbs = await db.query('SELECT * FROM databases WHERE parent_page_id = ?', [parentId]);

  const enriched = [];
  for (const d of dbs) {
    const props = await db.query('SELECT * FROM properties WHERE database_id = ? ORDER BY sort_order', [d.id]);
    const views = await db.query('SELECT * FROM views WHERE database_id = ? ORDER BY sort_order', [d.id]);
    enriched.push({ ...d, properties: props, views });
  }
  return c.json({ databases: enriched });
});

// POST /databases
app.post('/', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const schema = z.object({ parent_page_id: z.string(), name: z.string().optional() });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const { parent_page_id, name } = parsed.data;
  const db = createDb(c.env.DB);
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.prepare('INSERT INTO databases (id, parent_page_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, parent_page_id, name ?? 'Untitled Database', now, now)
    .run();

  // Seed default properties
  const props = ['Name', 'Status', 'Tags', 'Due Date'];
  for (let i = 0; i < props.length; i++) {
    const pid = crypto.randomUUID();
    const ptype = i === 0 ? 'text' : i === 1 ? 'select' : i === 2 ? 'multi_select' : 'date';
    await db.prepare('INSERT INTO properties (id, database_id, name, type, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(pid, id, props[i], ptype, i, now, now)
      .run();
  }

  // Seed default views
  const viewId = crypto.randomUUID();
  await db.prepare('INSERT INTO views (id, database_id, type, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(viewId, id, 'table', 'Table', 0, now, now)
    .run();

  return c.json({ database: { id, parent_page_id, name: name ?? 'Untitled Database', created_at: now, updated_at: now } });
});

// DELETE /databases/:id
app.delete('/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  await createDb(c.env.DB).prepare('DELETE FROM databases WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

export default app;
