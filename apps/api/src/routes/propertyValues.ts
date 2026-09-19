import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware } from '../auth';
import type { AppEnv } from '../types';

const app = new Hono<AppEnv>();
app.use('*', authMiddleware);

// Batch get property values for rows
app.get('/', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const pageIds = c.req.queries('page_id');
  const db = createDb(c.env.DB);

  if (!pageIds?.length) return c.json({ values: [] });

  const placeholders = pageIds.map(() => '?').join(',');
  const values = await db.query(
    `SELECT pv.*, p.name AS property_name, p.type AS property_type, p.config AS property_config
     FROM property_values pv
     JOIN properties p ON p.id = pv.property_id
     WHERE pv.page_id IN (${placeholders})`,
    pageIds
  );
  return c.json({ values });
});

// Update or create a cell value
app.post('/', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const { property_id, page_id, value } = body;
  if (!property_id || !page_id) return c.json({ error: 'Missing property_id or page_id' }, 400);

  const db = createDb(c.env.DB);
  const now = Math.floor(Date.now() / 1000);

  // Upsert
  const id = crypto.randomUUID();
  await db.prepare(
    'INSERT INTO property_values (id, property_id, page_id, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(property_id, page_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  )
    .bind(id, property_id, page_id, JSON.stringify(value), now, now)
    .run();

  return c.json({ value: id });
});

export default app;
