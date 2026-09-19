import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ExecutionContext } from '@cloudflare/workers-types';

import { authMiddleware } from '../server/auth';
import authRoutes from '../server/auth';
import workspaceRoutes from '../server/routes/workspaces';
import pageRoutes from '../server/routes/pages';
import mcpRoutes from '../server/routes/mcp';
import databaseRoutes from '../server/routes/databases';
import propertyRoutes from '../server/routes/properties';
import propertyValueRoutes from '../server/routes/propertyValues';
import viewRoutes from '../server/routes/views';
import backlinkRoutes from '../server/routes/backlinks';
import settingsRoutes from '../server/routes/settings';
import { BotionSyncRoom } from '../server/durable-objects/BotionSyncRoom';
import { handlePageSaveQueue } from '../server/queue/pageSaveConsumer';
import type { AppEnv } from '../server/types';

const app = new Hono<AppEnv>();

app.use('*', cors({ origin: '*', credentials: true }));
app.use('*', authMiddleware);

// Health
app.get('/health', (c) => c.json({ ok: true, env: c.env.ENVIRONMENT }));

// REST API routes
app.route('/auth', authRoutes);
app.route('/workspaces', workspaceRoutes);
app.route('/pages', pageRoutes);
app.route('/databases', databaseRoutes);
app.route('/properties', propertyRoutes);
app.route('/property-values', propertyValueRoutes);
app.route('/views', viewRoutes);
app.route('/backlinks', backlinkRoutes);
app.route('/settings', settingsRoutes);
app.route('/mcp', mcpRoutes);

// Worker entry
export default {
  async fetch(request: Request, env: AppEnv['Bindings'], ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },

  async queue(batch: any, env: AppEnv['Bindings'], ctx: ExecutionContext) {
    ctx.waitUntil(handlePageSaveQueue(batch, env));
  },
};

// Durable Object export
export { BotionSyncRoom };
