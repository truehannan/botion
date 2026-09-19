import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware } from '../auth';
import type { AppEnv } from '../types';

const app = new Hono<AppEnv>();
app.use('*', authMiddleware);

// GET /backlinks?target_page_id=...
app.get('/', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const targetId = c.req.query('target_page_id');
  if (!targetId) return c.json({ error: 'Missing target_page_id' }, 400);

  const db = createDb(c.env.DB);
  const links = await db.query(
    'SELECT b.*, p.title AS source_title FROM backlinks b JOIN pages p ON p.id = b.source_page_id WHERE b.target_page_id = ?',
    [targetId]
  );
  return c.json({ backlinks: links });
});

// POST /backlinks
app.post('/', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const { source_page_id, target_page_id, block_id, context } = body;

  const db = createDb(c.env.DB);
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.prepare(
    'INSERT INTO backlinks (id, source_page_id, target_page_id, block_id, context, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING'
  )
    .bind(id, source_page_id, target_page_id, block_id ?? null, context ?? null, now)
    .run();

  return c.json({ backlink: { id } });
});

export default app;
