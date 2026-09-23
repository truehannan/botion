import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ExecutionContext } from '@cloudflare/workers-types';

import { ensureSchema } from '../server/local-init';
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
import syncRoutes from '../server/routes/sync';
import { handlePageSaveQueue } from '../server/queue/pageSaveConsumer';
import type { AppEnv } from '../server/types';

const app = new Hono<AppEnv>();

// All API routes live under /api so a single Worker can also serve the
// static frontend (see [assets] in wrangler.toml, run_worker_first=["/api/*"]).
const api = new Hono<AppEnv>();

app.use('*', cors({ origin: '*', credentials: true }));

// Auto-init schema in local/development mode
api.use('*', async (c, next) => {
  if (c.env.ENVIRONMENT === 'development' || c.env.ENVIRONMENT === 'local') {
    await ensureSchema(c.env.DB);
  }
  await next();
});

api.use('*', authMiddleware);

// Health
api.get('/health', (c) => c.json({ ok: true, env: c.env.ENVIRONMENT }));

// REST API routes
api.route('/auth', authRoutes);
api.route('/workspaces', workspaceRoutes);
api.route('/pages', pageRoutes);
api.route('/databases', databaseRoutes);
api.route('/properties', propertyRoutes);
api.route('/property-values', propertyValueRoutes);
api.route('/views', viewRoutes);
api.route('/backlinks', backlinkRoutes);
api.route('/settings', settingsRoutes);
api.route('/sync', syncRoutes);
api.route('/mcp', mcpRoutes);

// Mount the API under /api. Also expose /health at the root for uptime checks.
app.get('/health', (c) => c.json({ ok: true, env: c.env.ENVIRONMENT }));
app.route('/api', api);

// Worker entry
export default {
  async fetch(request: Request, env: AppEnv['Bindings'], ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },

  async queue(batch: any, env: AppEnv['Bindings'], ctx: ExecutionContext) {
    ctx.waitUntil(handlePageSaveQueue(batch, env));
  },
};
