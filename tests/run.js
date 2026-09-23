#!/usr/bin/env node
/**
 * run.js — End-to-end test flow against a local Botion worker.
 *
 * This script simulates a complete user journey:
 *  1. Register a user
 *  2. Login
 *  3. Create a workspace
 *  4. Create pages
 *  5. Edit a page (sync content)
 *  6. Create a database
 *  7. Query AI MCP endpoint
 *  8. Verify data integrity
 *
 * Run: node tests/run.js
 * Requires: local worker running on http://127.0.0.1:8787
 */

const BASE = process.env.BOTION_TEST_URL || 'http://127.0.0.1:8787/api';

async function fetchJson(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function log(step, ok, detail) {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${step}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
  console.log('🧪 Botion E2E Test Runner');
  console.log(`   Target: ${BASE}\n`);

  let token = '';
  let userId = '';
  let workspaceId = '';
  let pageId = '';

  try {
    // ── Health check ────────────────────────────────────
    const health = await fetchJson('/health');
    log('Health check', health.ok === true, health.env);
  } catch (e) {
    log('Health check', false, e.message);
    console.error('\n   Is the worker running? Try: pnpm dev:worker:local');
    process.exit(1);
  }

  try {
    // ── Register ──────────────────────────────────────────
    const email = `test-${Date.now()}@local.dev`;
    const reg = await fetchJson('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'testpass123', name: 'Test User' }),
    });
    token = reg.token;
    userId = reg.user.id;
    log('Register', !!token, reg.user.email);
  } catch (e) {
    log('Register', false, e.message);
    process.exit(1);
  }

  try {
    // ── Me ────────────────────────────────────────────────
    const me = await fetchJson('/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    log('Auth /me', me.user?.id === userId, me.user.email);
  } catch (e) {
    log('Auth /me', false, e.message);
  }

  try {
    // ── Create workspace ──────────────────────────────────
    const ws = await fetchJson('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Workspace', slug: `test-${Date.now()}` }),
      headers: { Authorization: `Bearer ${token}` },
    });
    workspaceId = ws.workspace.id;
    log('Create workspace', !!workspaceId, ws.workspace.name);
  } catch (e) {
    log('Create workspace', false, e.message);
    process.exit(1);
  }

  try {
    // ── List workspaces ───────────────────────────────────
    const list = await fetchJson('/workspaces', { headers: { Authorization: `Bearer ${token}` } });
    log('List workspaces', list.workspaces?.length >= 1, `${list.workspaces?.length} workspace(s)`);
  } catch (e) {
    log('List workspaces', false, e.message);
  }

  try {
    // ── Create page ───────────────────────────────────────
    const page = await fetchJson('/pages', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: workspaceId, title: 'Test Page', parent_id: null }),
      headers: { Authorization: `Bearer ${token}` },
    });
    pageId = page.page.id;
    log('Create page', !!pageId, page.page.title);
  } catch (e) {
    log('Create page', false, e.message);
    process.exit(1);
  }

  try {
    // ── Sync page content ─────────────────────────────────
    const sync = await fetchJson(`/sync/${pageId}`, {
      method: 'POST',
      body: JSON.stringify({
        blocks: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Hello from test!' }] },
        ],
        title: 'Test Page Updated',
        workspaceId,
      }),
      headers: { Authorization: `Bearer ${token}` },
    });
    log('Sync page content', sync.success === true);
  } catch (e) {
    log('Sync page content', false, e.message);
  }

  try {
    // ── Retrieve synced page ────────────────────────────────
    const retrieved = await fetchJson(`/sync/${pageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const hasBlock = retrieved.state?.blocks?.some((b) => b.content?.[0]?.text === 'Hello from test!');
    log('Retrieve synced page', hasBlock === true);
  } catch (e) {
    log('Retrieve synced page', false, e.message);
  }

  try {
    // ── Create database ─────────────────────────────────
    const db = await fetchJson('/databases', {
      method: 'POST',
      body: JSON.stringify({ parent_page_id: pageId, name: 'Test DB' }),
      headers: { Authorization: `Bearer ${token}` },
    });
    log('Create database', !!db.database?.id, db.database?.name);
  } catch (e) {
    log('Create database', false, e.message);
  }

  try {
    // ── MCP Chat ──────────────────────────────────────────
    const mcp = await fetchJson('/mcp/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Create a page called Local Testing' }],
        workspaceId,
      }),
      headers: { Authorization: `Bearer ${token}` },
    });
    log('MCP Chat', !!mcp.message);
  } catch (e) {
    log('MCP Chat', false, e.message);
  }

  try {
    // ── Update page metadata ──────────────────────────────
    const update = await fetchJson(`/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ icon: '🧪' }),
      headers: { Authorization: `Bearer ${token}` },
    });
    log('Update page icon', update.page?.icon === '🧪');
  } catch (e) {
    log('Update page icon', false, e.message);
  }

  try {
    // ── Settings ──────────────────────────────────────────
    await fetchJson('/settings', {
      method: 'PUT',
      body: JSON.stringify({ theme: 'dark', ui_font: 'inter' }),
      headers: { Authorization: `Bearer ${token}` },
    });
    const settings = await fetchJson('/settings', { headers: { Authorization: `Bearer ${token}` } });
    log('Settings save/load', settings.settings?.theme === 'dark');
  } catch (e) {
    log('Settings save/load', false, e.message);
  }

  console.log('\n🎉 Test run complete.');
}

main().catch((err) => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
