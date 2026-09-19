import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware } from '../auth';
import type { AppEnv } from '../types';

const app = new Hono<AppEnv>();
app.use('*', authMiddleware);

// GET /settings (current user)
app.get('/', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const db = createDb(c.env.DB);
  const settings = await db.queryOne('SELECT * FROM user_settings WHERE user_id = ?', [user.id]);
  return c.json({ settings: settings ?? { theme: 'system', ui_font: 'inter', reading_font: null } });
});

// PUT /settings
app.put('/', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const db = createDb(c.env.DB);
  const now = Math.floor(Date.now() / 1000);

  await db.prepare(
    'INSERT INTO user_settings (user_id, theme, ui_font, reading_font, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?) ' +
    'ON CONFLICT(user_id) DO UPDATE SET theme = excluded.theme, ui_font = excluded.ui_font, reading_font = excluded.reading_font, updated_at = excluded.updated_at'
  )
    .bind(user.id, body.theme ?? 'system', body.ui_font ?? 'inter', body.reading_font ?? null, now, now)
    .run();

  return c.json({ success: true });
});

export default app;
