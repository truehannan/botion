import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './auth';
import authRoutes from './auth';
import workspaceRoutes from './routes/workspaces';
import pageRoutes from './routes/pages';
import mcpRoutes from './routes/mcp';
import databaseRoutes from './routes/databases';
import propertyRoutes from './routes/properties';
import propertyValueRoutes from './routes/propertyValues';
import viewRoutes from './routes/views';
import backlinkRoutes from './routes/backlinks';
import settingsRoutes from './routes/settings';
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
app.route('/databases', databaseRoutes);
app.route('/properties', propertyRoutes);
app.route('/property-values', propertyValueRoutes);
app.route('/views', viewRoutes);
app.route('/backlinks', backlinkRoutes);
app.route('/settings', settingsRoutes);
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
