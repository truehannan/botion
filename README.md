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
├── wrangler.toml          # Worker config (at root)
├── package.json           # Root monorepo scripts
├── pnpm-workspace.yaml
├── src/
│   └── index.ts           # Worker entry (Hono app + DO export)
├── server/
│   ├── auth.ts            # JWT auth + middleware
│   ├── db.ts              # D1 wrapper (pure serverless)
│   ├── types.ts           # Hono Env types
│   ├── durable-objects/
│   │   └── BotionSyncRoom.ts
│   ├── queue/
│   │   └── pageSaveConsumer.ts
│   └── routes/
│       ├── auth.ts
│       ├── workspaces.ts
│       ├── pages.ts
│       ├── databases.ts
│       ├── properties.ts
│       ├── propertyValues.ts
│       ├── views.ts
│       ├── backlinks.ts
│       ├── settings.ts
│       └── mcp.ts
├── client/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── blocks/        # Custom BlockNote blocks
│   │   ├── components/
│   │   ├── components/views
│   │   ├── components/database
│   │   ├── stores/
│   │   ├── themes/
│   │   └── lib/
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── wrangler.toml      # Pages config
│   └── package.json
├── migrations/
│   ├── 0001_init.sql
│   ├── 0002_database_engine.sql
│   ├── schema.sql         # Canonical schema (db-sync source)
│   └── scripts/
│       └── db-sync.js     # Auto-generate D1 migrations
├── .github/workflows/
│   ├── deploy.yml         # Deploy Worker + Pages on push to main
│   └── release.yml        # Build Tauri binaries on tags
├── public/
└── README.md
```

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 9+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- (Optional) [Rust](https://rustup.rs/) + [Tauri prerequisites](https://tauri.app/start/prerequisites/)

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure Cloudflare resources

```bash
npx wrangler d1 create botion-db
npx wrangler r2 bucket create botion-storage
npx wrangler vectorize create botion-vectors --dimensions=768 --metric=cosine
npx wrangler queues create page-save-queue
```

Then fill the generated IDs into `wrangler.toml`.

### 3. Set secrets

```bash
npx wrangler secret put JWT_SECRET
```

### 4. Run migrations

```bash
pnpm db:migrate:local   # local dev
pnpm db:migrate         # production

# Or auto-generate from schema.sql:
pnpm db:sync
```

### 5. Start development

Terminal 1 — Worker (http://127.0.0.1:8787):
```bash
pnpm dev:worker
```

Terminal 2 — Web app (http://localhost:5173):
```bash
pnpm dev:client
```

Vite proxies `/api/*` → `127.0.0.1:8787` and strips the `/api` prefix before forwarding.

### 6. Native app (Tauri)

```bash
pnpm dev:tauri
```

## Environment Variables

Create `client/.env.local` for production:

```
VITE_API_URL=https://botion-api.your-account.workers.dev
VITE_WS_URL=wss://botion-api.your-account.workers.dev
```

## Deployment

The `deploy.yml` workflow triggers on every push to `main`:
- Builds + type-checks Worker & client
- Deploys Worker via `cloudflare/wrangler-action@v3`
- Deploys Pages via `cloudflare/wrangler-action@v3`

Required secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

Tag a release to trigger Tauri builds:

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Serverless Compliance

All backend code runs strictly inside Cloudflare V8 isolates:

- No `fs`, `path`, `http`, `process`, `Buffer` in runtime code
- `crypto.randomUUID()` and `crypto.subtle.digest()` — Web Crypto
- `jose` v5 — pure Web Crypto
- `yjs` — pure JS, runs in DO isolate
- `zod` — pure JS
