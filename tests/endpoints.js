#!/usr/bin/env node
/**
 * tests/endpoints.js — comprehensive endpoint + CRUD flow tests for Botion.
 *
 * Exercises every API route with realistic flows:
 *   auth (register/login/me + negative cases), workspaces, pages CRUD,
 *   databases + properties + views + property-values, backlinks, settings,
 *   sync (save/load), and mcp chat. Also checks auth enforcement (401s) and
 *   validation (400s).
 *
 * Usage:
 *   BOTION_TEST_URL=http://127.0.0.1:8787/api node tests/endpoints.js
 *   (defaults to http://127.0.0.1:8787/api)
 *
 * Exit code is non-zero if any assertion fails.
 */

const BASE = process.env.BOTION_TEST_URL || 'http://127.0.0.1:8787/api';

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`✅ ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    failed++;
    failures.push(name + (detail ? ` — ${detail}` : ''));
    console.log(`❌ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function req(path, { method = 'GET', body, token, raw = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  const text = await res.text();
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return raw ? { status: res.status, json, text } : { status: res.status, json };
}

async function main() {
  console.log(`🧪 Botion Endpoint Suite\n   Target: ${BASE}\n`);

  // ── Health ────────────────────────────────────────────
  {
    const r = await req('/health');
    ok('GET /health', r.status === 200 && r.json?.ok === true, `status=${r.status}`);
  }

  // ── Auth: validation + negative cases ─────────────────
  {
    const r = await req('/auth/register', { method: 'POST', body: { email: 'bad', password: '' } });
    ok('register rejects invalid input (400)', r.status === 400, `status=${r.status}`);
  }
  {
    const r = await req('/auth/login', { method: 'POST', body: { email: 'nobody@nope.dev', password: 'whatever' } });
    ok('login unknown user (401)', r.status === 401, `status=${r.status}`);
  }
  {
    const r = await req('/auth/me');
    ok('me without token (401)', r.status === 401, `status=${r.status}`);
  }

  // ── Auth: register + login + me (happy path) ──────────
  const email = `suite-${Date.now()}@local.dev`;
  const password = 'pw123456';
  let token = null;
  {
    const r = await req('/auth/register', { method: 'POST', body: { email, password, name: 'Suite' } });
    ok('POST /auth/register', r.status === 200 && !!r.json?.token, `status=${r.status}`);
    token = r.json?.token;
  }
  {
    const r = await req('/auth/register', { method: 'POST', body: { email, password } });
    ok('register duplicate email (409)', r.status === 409, `status=${r.status}`);
  }
  {
    const r = await req('/auth/login', { method: 'POST', body: { email, password } });
    ok('POST /auth/login (correct)', r.status === 200 && !!r.json?.token, `status=${r.status}`);
    token = r.json?.token || token;
  }
  {
    const r = await req('/auth/login', { method: 'POST', body: { email, password: 'wrong' } });
    ok('login wrong password (401)', r.status === 401, `status=${r.status}`);
  }
  {
    const r = await req('/auth/me', { token });
    ok('GET /auth/me', r.status === 200 && r.json?.user?.email === email, `status=${r.status}`);
  }

  if (!token) {
    console.log('\n⛔ No token — cannot continue authenticated flows.');
    return finish();
  }

  // ── Workspaces CRUD ───────────────────────────────────
  let workspaceId = null;
  {
    const slug = `suite-ws-${Date.now()}`;
    const r = await req('/workspaces', { method: 'POST', body: { name: 'Suite WS', slug }, token });
    ok('POST /workspaces', r.status === 200 && !!r.json?.workspace?.id, `status=${r.status}`);
    workspaceId = r.json?.workspace?.id;
  }
  {
    const r = await req('/workspaces', { token });
    ok('GET /workspaces (list)', r.status === 200 && Array.isArray(r.json?.workspaces), `count=${r.json?.workspaces?.length}`);
  }
  {
    const r = await req(`/workspaces/${workspaceId}`, { token });
    ok('GET /workspaces/:id', r.status === 200 && r.json?.workspace?.id === workspaceId, `status=${r.status}`);
  }
  {
    const r = await req('/workspaces', { method: 'POST', body: { name: '' }, token });
    ok('workspaces rejects invalid (400)', r.status === 400, `status=${r.status}`);
  }

  // ── Pages CRUD ────────────────────────────────────────
  let pageId = null;
  {
    const r = await req('/pages', { method: 'POST', body: { workspace_id: workspaceId, title: 'Suite Page' }, token });
    ok('POST /pages', r.status === 200 && !!r.json?.page?.id, `status=${r.status}`);
    pageId = r.json?.page?.id;
  }
  {
    const r = await req(`/pages?workspace_id=${workspaceId}`, { token });
    ok('GET /pages?workspace_id', r.status === 200 && Array.isArray(r.json?.pages), `count=${r.json?.pages?.length}`);
  }
  {
    const r = await req(`/pages/${pageId}`, { token });
    ok('GET /pages/:id', r.status === 200 && r.json?.page?.id === pageId, `status=${r.status}`);
  }
  {
    const r = await req(`/pages/${pageId}`, { method: 'PATCH', body: { title: 'Renamed', icon: '📄' }, token });
    ok('PATCH /pages/:id', r.status === 200 && r.json?.page?.title === 'Renamed', `status=${r.status}`);
  }

  // ── Sync (save/load) ──────────────────────────────────
  {
    const blocks = [{ type: 'paragraph', content: 'hello suite' }];
    const r = await req(`/sync/${pageId}`, { method: 'POST', body: { blocks, title: 'Renamed', workspaceId }, token });
    ok('POST /sync/:pageId', r.status === 200 && r.json?.success === true, `status=${r.status}`);
  }
  {
    const r = await req(`/sync/${pageId}`, { token });
    ok('GET /sync/:pageId', r.status === 200 && r.json?.state?.blocks?.length >= 1, `status=${r.status}`);
  }

  // ── Databases + properties + views + values ───────────
  let databaseId = null;
  {
    const r = await req('/databases', { method: 'POST', body: { parent_page_id: pageId, name: 'Suite DB' }, token });
    ok('POST /databases', r.status === 200 && !!r.json?.database?.id, `status=${r.status}`);
    databaseId = r.json?.database?.id;
  }
  {
    const r = await req(`/databases?parent_page_id=${pageId}`, { token });
    ok('GET /databases?parent_page_id', r.status === 200 && Array.isArray(r.json?.databases), `count=${r.json?.databases?.length}`);
  }
  let propertyId = null;
  {
    const r = await req('/properties', { method: 'POST', body: { database_id: databaseId, name: 'Priority', type: 'select' }, token });
    ok('POST /properties', r.status === 200 && !!r.json?.property?.id, `status=${r.status}`);
    propertyId = r.json?.property?.id;
  }
  {
    const r = await req(`/properties/${propertyId}`, { method: 'PATCH', body: { name: 'Priority Level' }, token });
    ok('PATCH /properties/:id', r.status === 200 && r.json?.property?.name === 'Priority Level', `status=${r.status}`);
  }
  let viewId = null;
  {
    const r = await req('/views', { method: 'POST', body: { database_id: databaseId, type: 'board', name: 'Board' }, token });
    ok('POST /views', r.status === 200 && !!r.json?.view?.id, `status=${r.status}`);
    viewId = r.json?.view?.id;
  }
  {
    const r = await req(`/views/${viewId}`, { method: 'PATCH', body: { name: 'Kanban' }, token });
    ok('PATCH /views/:id', r.status === 200 && r.json?.view?.name === 'Kanban', `status=${r.status}`);
  }
  {
    const r = await req('/property-values', { method: 'POST', body: { property_id: propertyId, page_id: pageId, value: 'High' }, token });
    ok('POST /property-values', r.status === 200 && !!r.json?.value, `status=${r.status}`);
  }
  {
    const r = await req(`/property-values?page_id=${pageId}`, { token });
    ok('GET /property-values?page_id', r.status === 200 && Array.isArray(r.json?.values), `count=${r.json?.values?.length}`);
  }

  // ── Backlinks ─────────────────────────────────────────
  let page2Id = null;
  {
    const r = await req('/pages', { method: 'POST', body: { workspace_id: workspaceId, title: 'Suite Page 2' }, token });
    page2Id = r.json?.page?.id;
    ok('POST /pages (second)', r.status === 200 && !!page2Id, `status=${r.status}`);
  }
  {
    const r = await req('/backlinks', { method: 'POST', body: { source_page_id: page2Id, target_page_id: pageId, context: 'mention' }, token });
    ok('POST /backlinks', r.status === 200 && !!r.json?.backlink?.id, `status=${r.status}`);
  }
  {
    const r = await req(`/backlinks?target_page_id=${pageId}`, { token });
    ok('GET /backlinks?target_page_id', r.status === 200 && Array.isArray(r.json?.backlinks) && r.json.backlinks.length >= 1, `count=${r.json?.backlinks?.length}`);
  }

  // ── Settings ──────────────────────────────────────────
  {
    const r = await req('/settings', { method: 'PUT', body: { theme: 'dark', ui_font: 'inter' }, token });
    ok('PUT /settings', r.status === 200 && r.json?.success === true, `status=${r.status}`);
  }
  {
    const r = await req('/settings', { token });
    ok('GET /settings', r.status === 200 && r.json?.settings?.theme === 'dark', `theme=${r.json?.settings?.theme}`);
  }

  // ── MCP chat ──────────────────────────────────────────
  {
    const r = await req('/mcp/chat', { method: 'POST', body: { messages: [{ role: 'user', content: 'search suite page' }], workspaceId }, token });
    ok('POST /mcp/chat', r.status === 200 && r.json?.message !== undefined, `status=${r.status}`);
  }

  // ── Auth enforcement: a protected route without token ─
  {
    const r = await req('/workspaces');
    ok('workspaces without token (401)', r.status === 401, `status=${r.status}`);
  }

  // ── Deletes (cleanup + verify) ────────────────────────
  {
    const r = await req(`/views/${viewId}`, { method: 'DELETE', token });
    ok('DELETE /views/:id', r.status === 200 && r.json?.success === true, `status=${r.status}`);
  }
  {
    const r = await req(`/properties/${propertyId}`, { method: 'DELETE', token });
    ok('DELETE /properties/:id', r.status === 200 && r.json?.success === true, `status=${r.status}`);
  }
  {
    const r = await req(`/databases/${databaseId}`, { method: 'DELETE', token });
    ok('DELETE /databases/:id', r.status === 200 && r.json?.success === true, `status=${r.status}`);
  }
  {
    const r = await req(`/pages/${pageId}`, { method: 'DELETE', token });
    ok('DELETE /pages/:id', r.status === 200 && r.json?.success === true, `status=${r.status}`);
  }
  {
    const r = await req(`/pages/${pageId}`, { token });
    ok('deleted page is gone (404)', r.status === 404, `status=${r.status}`);
  }

  finish();
}

function finish() {
  console.log(`\n${failed === 0 ? '🎉' : '⚠️'} ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
