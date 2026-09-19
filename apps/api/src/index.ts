import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ExecutionContext } from '@cloudflare/workers-types';

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

// CORS — tighten origin in production.
app.use('*', cors({ origin: '*', credentials: true }));

// JWT auth middleware (sets c.var.user).
app.use('*', authMiddleware);

// Health
app.get('/health', (c) => c.json({ ok: true, env: c.env.ENVIRONMENT }));

// ── REST API routes ──────────────────────────────────────────────
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

// ── Worker entry ─────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: AppEnv['Bindings'], ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },

  async queue(batch: any, env: AppEnv['Bindings'], ctx: ExecutionContext) {
    ctx.waitUntil(handlePageSaveQueue(batch, env));
  },
};

// ── Durable Object export ────────────────────────────────────────
export { BotionSyncRoom };
