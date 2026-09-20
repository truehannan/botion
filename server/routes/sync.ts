import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware } from '../auth';
import type { AppEnv } from '../types';

const app = new Hono<AppEnv>();
app.use('*', authMiddleware);

/**
 * POST /sync/:pageId
 * Client-side auto-save: persists BlockNote JSON to D1 directly.
 * Used as a fallback when Durable Objects / WebSockets are unavailable
 * (local mode, offline, or user preference).
 */
app.post('/:pageId', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const pageId = c.req.param('pageId');
  const body = await c.req.json();
  const { blocks, title } = body;
  const db = createDb(c.env.DB);
  const now = Math.floor(Date.now() / 1000);

  // Persist the JSON blocks as Yjs state (or raw JSON blob)
  const state = new TextEncoder().encode(JSON.stringify({ blocks, updated_at: now }));

  await db.prepare(
    'INSERT INTO document_states (page_id, state, updated_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(page_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at'
  )
    .bind(pageId, state, now)
    .run();

  // Update page title if provided
  if (title !== undefined) {
    await db.prepare('UPDATE pages SET title = ?, updated_at = ? WHERE id = ?')
      .bind(title, now, pageId)
      .run();
  }

  // Queue for AI embedding
  try {
    await c.env.PAGE_SAVE_QUEUE.send({ pageId, workspaceId: body.workspaceId, title: title ?? 'Untitled', updatedAt: now });
  } catch { /* ignore in local mode */ }

  return c.json({ success: true, updated_at: now });
});

/**
 * GET /sync/:pageId
 * Retrieve the latest saved state for a page.
 */
app.get('/:pageId', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const pageId = c.req.param('pageId');
  const db = createDb(c.env.DB);
  const row = await db.queryOne<{ state: ArrayBuffer; updated_at: number }>(
    'SELECT state, updated_at FROM document_states WHERE page_id = ?',
    [pageId]
  );

  if (!row) return c.json({ state: null });

  // Try to parse as JSON (client-side sync format), fallback to Yjs binary
  try {
    const text = new TextDecoder().decode(new Uint8Array(row.state));
    const parsed = JSON.parse(text);
    return c.json({ state: parsed, updated_at: row.updated_at });
  } catch {
    return c.json({ state: Array.from(new Uint8Array(row.state)), updated_at: row.updated_at });
  }
});

export default app;
