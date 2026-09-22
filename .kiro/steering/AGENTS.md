# Botion — AI Agent Steering Document

> **Project**: Botion — Edge-native, real-time collaborative workspace (Notion clone + AI)
> **Architecture**: 100% Cloudflare serverless (Workers, D1, R2, DO, Queues, Workers AI)
> **Client**: React 18 + Vite + Tailwind + BlockNote, Tauri v2 for native binaries
> **Last Updated**: 2026-09-20

---

## 1. Architecture Overview

```
botion/
├── wrangler.toml              # Worker config at ROOT
├── src/index.ts               # Worker entry (Hono + DO export)
├── server/                    # All backend code
│   ├── auth.ts                # JWT auth (jose + SHA-256)
│   ├── db.ts                  # D1 typed wrapper
│   ├── local-init.ts          # Auto-creates schema on first dev request
│   ├── types.ts               # Hono Env types
│   ├── queue/
│   │   └── pageSaveConsumer.ts # Embedding pipeline (Vectorize optional)
│   ├── routes/
│   │   ├── auth.ts            # Register / Login / Me
│   │   ├── workspaces.ts      # CRUD
│   │   ├── pages.ts           # CRUD + /:id/sync (WebSocket)
│   │   ├── sync.ts            # REST-based page sync (auto-save fallback)
│   │   ├── databases.ts       # CRUD + seed defaults
│   │   ├── properties.ts      # CRUD (13 types)
│   │   ├── propertyValues.ts  # Batch + upsert
│   │   ├── views.ts           # CRUD (table, board, gallery, list, calendar, timeline)
│   │   ├── backlinks.ts       # Inverted index
│   │   ├── settings.ts        # Theme/font prefs
│   │   └── mcp.ts             # AI chat with MCP tools
│   └── utils/
│       ├── ai-mock.ts         # Deterministic embeddings + LLM mocks
│       └── env.ts             # Local mode detection
├── client/
│   ├── index.html
│   ├── vite.config.ts         # @/ alias, /api proxy, local mode flag
│   ├── wrangler.toml          # Pages config
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── blocks/            # Custom BlockNote blocks
│   │   │   ├── schema.ts      # Full schema (callout, code, math, toggle, embed, multiColumn, column, mention)
│   │   │   ├── callout.tsx
│   │   │   ├── code.tsx
│   │   │   ├── math.tsx
│   │   │   ├── toggle.tsx
│   │   │   ├── embed.tsx
│   │   │   ├── multiColumn.tsx
│   │   │   └── mention.tsx
│   │   ├── components/
│   │   │   ├── Editor.tsx     # BlockNote + Yjs/REST auto-save + inline AI
│   │   │   ├── Layout.tsx
│   │   │   ├── Sidebar.tsx    # Draggable tree
│   │   │   ├── PageHeader.tsx # Cover image + icon
│   │   │   ├── AuthPage.tsx
│   │   │   ├── NativeAuthScreen.tsx
│   │   │   ├── SlashMenu.tsx
│   │   │   ├── MentionsModal.tsx
│   │   │   ├── MentionSuggestionMenu.tsx
│   │   │   ├── InlineAIWidget.tsx
│   │   │   ├── BacklinksFooter.tsx
│   │   │   ├── Logo.tsx
│   │   │   ├── views/         # TableView, BoardView, GalleryView, ListView, CalendarView
│   │   │   └── database/
│   │   │       └── DatabaseEngine.tsx
│   │   ├── stores/
│   │   │   ├── authStore.ts   # Zustand JWT
│   │   │   ├── uiStore.ts     # Zustand sidebar/pages/AI state
│   │   │   └── databaseStore.ts # Properties, views, rows
│   │   ├── themes/
│   │   │   ├── Provider.tsx
│   │   │   └── Toggle.tsx
│   │   └── lib/
│   │       ├── api.ts         # All REST endpoints typed
│   │       ├── yjsProvider.ts  # Yjs + Awareness + WebSocket
│   │       ├── persistence.ts # IndexedDB offline + queue + debounce
│   │       └── utils.ts
│   └── src-tauri/             # Tauri v2
│       ├── Cargo.toml
│       ├── tauri.conf.json    # msi, dmg, deb, appimage, apk, aab
│       ├── build.rs
│       └── src/main.rs
├── migrations/
│   ├── 0001_init.sql          # Users, workspaces, pages, permissions, document_states
│   ├── 0002_database_engine.sql # Blocks, databases, properties, values, views, relations, backlinks, settings
│   └── schema.sql              # Canonical schema (db-sync.js source)
├── schema.sql                  # Moved to root for db-sync
├── scripts/
│   ├── setup.js                # Provisions D1, R2, Queue, Vectorize (optional), JWT_SECRET
│   └── db-sync.js              # Parses schema.sql → auto-generates migrations
├── tests/
│   ├── run.js                  # Full E2E test (13 assertions)
│   └── README.md
├── public/
└── .github/workflows/
    └── release.yml             # Tauri binary builds on tags
```

---

## 2. Critical Decisions Made

### 2.1 Sync (REST-based)
- Editing persists via **REST auto-save** (`POST /sync/:pageId`, `server/routes/sync.ts`)
  with debounced writes (2.5s) plus an IndexedDB offline queue (`persistence.ts`).
- The **Durable Object** that previously powered real-time WebSocket collaboration
  has been **removed** — this is a DO-free Worker. `prefersLocalSync()` is always
  true, so the client never opens a WebSocket. `/pages/:id/sync` returns 426.
- Tradeoff: no live multi-user cursors/instant sync; page content still saves and
  loads via REST + D1.

### 2.2 Local Development Mode
- `pnpm dev:local` runs worker+client entirely local via Miniflare
- D1 state persists in `.local/state` (SQL locally)
- AI services are **mocked** via `server/utils/ai-mock.ts` — deterministic with LCG-seeded embeddings
- No Cloudflare account credentials needed for local development
- D1 schema auto-creates on first request via `server/local-init.ts`

### 2.3 Vectorize is OPTIONAL
**Decision**: Vectorize is not strictly required. The search path falls back gracefully:
- **With Vectorize**: semantic search via `bge-base-en-v1.5` embeddings
- **Without Vectorize**: `VECTOR_INDEX.query()` is caught with try/catch; returns empty results with a note
- The queue consumer (`pageSaveConsumer.ts`) uses `runAI()` which falls back to mock embeddings in local mode
- **No build-time dependency on Vectorize** — the project deploys and runs fine without it
- Future: could replace with local client-side fuzzy search or browser-based embeddings if needed

### 2.4 Serverless Compliance
- No Node.js APIs in runtime (`fs`, `path`, `http`, `process`, `Buffer`)
- `crypto.randomUUID()` + `crypto.subtle.digest()` for password hashing
- `jose` v5 works natively on Web Crypto (no `nodejs_compat` flag)
- `yjs` runs purely in-memory inside the Worker isolate
- `wrangler deploy` bundles all server TS via esbuild (no `[build]` block needed in wrangler.toml)

---

## 3. Known Issues & Workarounds

### 3.1 Wrangler deployment
- Remove `[build]` from `wrangler.toml` — wrangler bundles TS natively
- **D1 (wrangler ≥ 4.45.0)**: the `[[d1_databases]]` block ships with
  `database_id = ""` (empty). Empty → `wrangler deploy` auto-provisions
  `botion-db` and links it. To bind an existing DB, pass the id at deploy:
  `pnpm deploy:worker --d1 <id>` or `D1_DATABASE_ID=<id>` — `scripts/deploy.js`
  writes it into the binding before `wrangler deploy`, and Cloudflare keeps the
  link on future deploys. Never hardcode a placeholder UUID — a stale id breaks
  deploy with "database with id ... not found". R2 and Queues auto-provision.
- **Vectorize is OPTIONAL and the binding is commented out** in `wrangler.toml`
  by default (it is NOT auto-provisioned, and the default Workers Builds token
  can't create it). Code guards `env.VECTOR_INDEX` (optional in `types.ts`), so
  the app runs without it — search falls back to `server/utils/text-search.ts`.
  To enable: `wrangler vectorize create botion-vectors --dimensions=768
  --metric=cosine`, then uncomment the `[[vectorize]]` binding.
- Workers Builds runs the **Build + Deploy commands set in the dashboard**
  (Settings → Build), not anything in `wrangler.toml`. Keep the Deploy command
  as `npx wrangler deploy`.
- `.dev.vars` is required locally for `JWT_SECRET` (used by `wrangler dev`)

### 3.2 GHA Release Workflow
- `--frozen-lockfile` fails without committed `pnpm-lock.yaml` — use `--no-frozen-lockfile` + `run_install: false`
- Node 20 is EOL for GitHub Actions; use Node 22
- macOS universal binary builds need two matrix entries (`aarch64` + `x86_64`)

### 3.3 Durable Objects removed
- The Worker is **DO-free**. The old `BotionSyncRoom` (Yjs + WebSocket
  Hibernation) was deleted, along with its `[[durable_objects]]` / `[[migrations]]`
  bindings in `wrangler.toml` and the `export { BotionSyncRoom }` in `src/index.ts`.
- Nothing in the runtime references a DO namespace anymore; deploys no longer
  require DO migrations.

### 3.4 MCP Chat Edge Cases
- LLM may return tool calls without `workspaceId`; the endpoint injects it before executing
- `parentId` can be undefined, `.bind(undefined)` throws D1_TYPE_ERROR → must use `?? null`

---

## 4. E2E Test Results

All 13 tests pass locally:
```
✅ Health check
✅ Register
✅ Auth /me
✅ Create workspace
✅ List workspaces
✅ Create page
✅ Sync page content
✅ Retrieve synced page
✅ Create database
✅ MCP Chat
✅ Update page icon
✅ Settings save/load
```

Run: `pnpm test` (requires worker on :8787)

---

## 5. Scripts Reference

| Script | What it does |
|--------|-------------|
| `pnpm dev:worker:local` | wrangler dev --local --persist-to=.local/state |
| `pnpm dev:client:local` | VITE_LOCAL_MODE=true vite dev |
| `pnpm dev:local` | Both worker + client concurrently |
| `pnpm build:client` | tsc && vite build |
| `pnpm build:tauri` | tauri build |
| `pnpm test` | node tests/run.js |
| `pnpm db:migrate:local` | wrangler d1 migrations apply --local |
| `pnpm db:sync` | node scripts/db-sync.js (auto-generate migrations) |
| `pnpm setup` | node scripts/setup.js (provision Cloudflare resources) |
| `pnpm deploy:worker` | wrangler deploy |
| `pnpm deploy:client` | wrangler pages deploy |

---

## 6. New / Remaining Tasks

These are the items identified as not yet fully implemented or requiring follow-up:

- [ ] **Tauri native icons**: `client/src-tauri/icons/` directory needs proper icon assets (32x32, 128x128, etc.)
- [ ] **Database view wiring**: DatabaseEngine.tsx has tabbed views but they are not yet connected to real API data; requires fetching properties/values when a database is loaded
- [ ] **Backlinks creation**: Backlinks footer reads from DB but @mentions in the editor don't yet create backlink rows via API
- [ ] **Relation properties**: The `relation` and `rollup` property types are in schema but not wired in the UI; TableView/BoardView don't support them visually yet
- [ ] **Gallery view cover images**: GalleryView checks `row.properties.cover` but cover images are on `pages.cover_image` — needs a join fetch
- [ ] **Calendar view date matching**: Stubs Month/Year; needs actual date property connections to page rows
- [ ] **Board view drag-and-drop persistence**: HTML5 DnD changes local state but doesn't PATCH the page back to server
- [ ] **User settings sync**: Stored per-user in D1 but the client doesn't fetch them on load; ThemeProvider doesn't read from API
- [ ] **Yjs document state migration**: Local auto-save stores JSON; DO stores Yjs binary. These formats don't auto-merge — need a migration/merge strategy
- [ ] **Vectorize UI**: When disabled, the AI agent should still search via D1 text search fallback (page titles) rather than returning empty
- [ ] **Date/timezone in calendar**: Calendar grid doesn't handle timezone offsets for Date properties
- [ ] **Native auth token storage**: Tauri uses `localStorage` for JWT; investigate `tauri-plugin-stronghold` or `tauri-plugin-keyring` for secure keystore
- [ ] **R2 file uploads**: Cover images are URL strings only; no R2-signed-upload flow for user uploads
- [ ] **Multi-column block rendering**: MultiColumnBlock has children but BlockNote may not render them correctly without a custom parent renderer
- [ ] **Code block syntax highlighting**: Only shows `<select>` for language; no actual Prism/Shiki highlighting applied
- [ ] **Math/LaTeX rendering**: `ref.current.innerHTML = text` is placeholder; needs KaTeX/MathJax integration
- [x] **Queue consumer error handling**: Vectorize-absent path handled — `pageSaveConsumer.ts` skips embedding cleanly and search uses the D1 text-search fallback (`server/utils/text-search.ts`)
- [x] **D1 database_id**: Resolved via wrangler v4 auto-provisioning — `[[d1_databases]]` is id-less; `wrangler deploy` creates/links the DB. No manual id to fill in.
- [ ] **Tailwind config `require()` in ESM**: tailwind.config.js uses ESM default export but `tailwindcss-animate` import might need CommonJS fallback checked per wrangler build
- [ ] **BlockNote collaboration fragment**: `doc.getXmlFragment('document-store')` is used but the actual Yjs integration in the editor uses a second `doc` created per mount — verify no Yjs doc conflicts
