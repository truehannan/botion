# Botion

Edge-native, real-time collaborative workspace. Entirely serverless on Cloudflare — Workers, D1, Durable Objects, R2, Queues, Vectorize, and Workers AI. Frontend deploys to Cloudflare Pages. Native binaries powered by Tauri v2.

## Architecture

| Layer | Technology | Runtime |
|-------|-----------|---------|
| Frontend | React 18 + Vite + Tailwind CSS + BlockNote | Cloudflare Pages |
| Backend | Hono on Cloudflare Workers | V8 Isolate |
| Database | Cloudflare D1 (SQLite) | Serverless |
| Real-time Sync | Durable Objects + WebSocket Hibernation + Yjs | Zero-cost idle |
| Storage | Cloudflare R2 | Object |
| AI / RAG | Workers AI + Vectorize | Edge inference |
| Native | Tauri v2 | Windows, macOS, Linux, Android |

## Project Structure

```
botion/
├── apps/
│   ├── api/                  # Hono Worker
│   │   ├── src/
│   │   │   ├── index.ts          # Worker entry (fetch + queue)
│   │   │   ├── auth.ts           # JWT auth + middleware
│   │   │   ├── db.ts             # D1 wrapper (zero Node.js)
│   │   │   ├── types.ts          # Hono Env types
│   │   │   ├── durable-objects/
│   │   │   │   └── BotionSyncRoom.ts   # DO hibernation + Yjs
│   │   │   ├── queue/
│   │   │   │   └── pageSaveConsumer.ts # Embedding pipeline
│   │   │   └── routes/
│   │   │       ├── auth.ts
│   │   │       ├── workspaces.ts
│   │   │       ├── pages.ts
│   │   │       ├── databases.ts
│   │   │       ├── properties.ts
│   │   │       ├── propertyValues.ts
│   │   │       ├── views.ts
│   │   │       ├── backlinks.ts
│   │   │       ├── settings.ts
│   │   │       └── mcp.ts
│   │   ├── migrations/
│   │   │   ├── 0001_init.sql
│   │   │   └── 0002_database_engine.sql
│   │   ├── schema.sql            # Canonical schema (db-sync source)
│   │   ├── scripts/
│   │   │   └── db-sync.js        # Auto-generate D1 migrations
│   │   ├── wrangler.toml         # Worker config (DO, D1, R2, Queue, AI)
│   │   └── package.json
│   └── web/                  # Vite React app
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── index.css
│       │   ├── blocks/           # Custom BlockNote blocks
│       │   ├── components/
│       │   ├── components/views/ # Database views (Table, Board, Gallery...)
│       │   ├── components/database/
│       │   ├── stores/
│       │   ├── themes/
│       │   ├── lib/
│       │   └── hooks/
│       ├── src-tauri/            # Tauri v2 native wrapper
│       ├── public/
│       ├── index.html
│       ├── vite.config.ts        # With @ alias + /api proxy
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       ├── wrangler.toml         # Pages config
│       └── package.json
├── .github/
│   └── workflows/
│       ├── deploy.yml          # Deploy Worker + Pages on push
│       └── release.yml       # Build Tauri binaries on tags
├── package.json                # Root monorepo config
├── pnpm-workspace.yaml
└── README.md
```

## Prerequisites

- Node.js 20+ (managed via `.nvmrc` if present)
- [pnpm](https://pnpm.io/) 9+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- (Optional) [Rust](https://rustup.rs/) + [Tauri prerequisites](https://tauri.app/start/prerequisites/) for native builds

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure Cloudflare resources

Create these resources in your Cloudflare dashboard, then update IDs in `apps/api/wrangler.toml`:

```bash
cd apps/api
npx wrangler d1 create botion-db
npx wrangler r2 bucket create botion-storage
npx wrangler vectorize create botion-vectors --dimensions=768 --metric=cosine
npx wrangler queues create page-save-queue
```

### 3. Set secrets

```bash
cd apps/api
npx wrangler secret put JWT_SECRET
```

### 4. Run migrations

```bash
pnpm db:migrate:local   # local dev
pnpm db:migrate         # production
```

The `db:sync` script auto-generates missing migrations from `schema.sql`:

```bash
pnpm db:sync
```

### 5. Start development

Terminal 1 — Worker (http://127.0.0.1:8787):
```bash
pnpm dev:api
```

Terminal 2 — Web app (http://localhost:5173):
```bash
pnpm dev:web
```

Vite proxies `/api/*` → `127.0.0.1:8787` with path rewrite (strips `/api` prefix). WebSockets are also proxied (`ws: true`).

### 6. Native app (Tauri)

```bash
pnpm dev:tauri
```

When opening the native app for the first time, enter your Worker URL (e.g. `https://botion-api.your-account.workers.dev`) and credentials.

## Environment Variables

Create `apps/web/.env.local` for production API target:

```
VITE_API_URL=https://botion-api.your-account.workers.dev
VITE_WS_URL=wss://botion-api.your-account.workers.dev
```

In dev, `VITE_API_URL` is omitted; Vite's proxy handles routing automatically.

## Deployment

### GitHub Actions

The `deploy.yml` workflow runs on every push to `main`:
- Builds + type-checks the Worker
- Builds the Pages frontend
- Deploys both via `cloudflare/wrangler-action@v3`

Required repository secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### Manual deployment

```bash
# Worker
pnpm deploy:api

# Pages
pnpm deploy:web
```

### Native releases

Tag a release to trigger Tauri builds for all platforms:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The `release.yml` workflow attaches `.exe`, `.msi`, `.dmg`, `.deb`, `.AppImage`, `.apk`, and `.aab` to the GitHub Release.

## Serverless Compliance

All backend code runs strictly inside Cloudflare V8 isolates:

- **No Node.js APIs** in runtime code (no `fs`, `path`, `http`, `process`)
- **Web Crypto** for JWT signing (`jose` via `crypto.subtle`)
- **D1** for all relational state (SQLite)
- **Durable Objects** with WebSocket Hibernation (`this.ctx.acceptWebSocket`)
- **Yjs** runs entirely in-memory inside the DO; no external state
- **Queue consumer** runs inside the same Worker isolate
- **Workers AI** + **Vectorize** for edge inference & RAG
