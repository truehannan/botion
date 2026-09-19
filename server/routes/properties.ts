import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware } from '../auth';
import type { AppEnv } from '../types';
import { z } from 'zod';

const app = new Hono<AppEnv>();
app.use('*', authMiddleware);

// POST /properties
app.post('/', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const schema = z.object({
    database_id: z.string(),
    name: z.string().min(1),
    type: z.enum([
      'text','number','select','multi_select','date','checkbox',
      'url','email','person','relation','rollup','formula','ai_autofill'
    ]),
    config: z.record(z.any()).optional(),
  });

  const parsed = schema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);

  const { database_id, name, type, config } = parsed.data;
  const db = createDb(c.env.DB);
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.prepare(
    'INSERT INTO properties (id, database_id, name, type, config, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, database_id, name, type, JSON.stringify(config ?? {}), 0, now, now)
    .run();

  return c.json({ property: { id, database_id, name, type, config: config ?? {}, created_at: now } });
});

// PATCH /properties/:id
app.patch('/:id', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const db = createDb(c.env.DB);
  const sets: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) { sets.push('name = ?'); params.push(body.name); }
  if (body.type !== undefined) { sets.push('type = ?'); params.push(body.type); }
  if (body.config !== undefined) { sets.push('config = ?'); params.push(JSON.stringify(body.config)); }
  if (body.sort_order !== undefined) { sets.push('sort_order = ?'); params.push(body.sort_order); }

  if (sets.length === 0) return c.json({ error: 'No fields to update' }, 400);
  params.push(c.req.param('id'));

  await db.prepare(`UPDATE properties SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();
  const row = await db.queryOne('SELECT * FROM properties WHERE id = ?', [c.req.param('id')]);
  return c.json({ property: row });
});

// DELETE /properties/:id
app.delete('/:id', async (c) => {
  const user = c.get('user'); if (!user) return c.json({ error: 'Unauthorized' }, 401);
  await createDb(c.env.DB).prepare('DELETE FROM properties WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ success: true });
});

export default app;
