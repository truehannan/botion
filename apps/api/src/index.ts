import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './auth';
import authRoutes from './auth';
import workspaceRoutes from './routes/workspaces';
import pageRoutes from './routes/pages';
import mcpRoutes from './routes/mcp';
import { BotionSyncRoom } from './durable-objects/BotionSyncRoom';
import { handlePageSaveQueue } from './queue/pageSaveConsumer';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

app.use('*', cors({ origin: '*', credentials: true }));
app.use('*', authMiddleware);

// Health
app.get('/health', (c) => c.json({ ok: true }));

// Routes
app.route('/auth', authRoutes);
app.route('/workspaces', workspaceRoutes);
app.route('/pages', pageRoutes);
app.route('/api/mcp', mcpRoutes);

// Queue handler
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },

  async queue(batch: any, env: any, ctx: ExecutionContext) {
    ctx.waitUntil(handlePageSaveQueue(batch, env));
  },
};

export { BotionSyncRoom };
