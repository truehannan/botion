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

**D1, R2 and the Queue auto-provision.** `wrangler.toml` declares these bindings
without resource IDs, so `wrangler deploy` (and Workers Builds) creates and
links them on first deploy — no manual `create` step. Requires **wrangler ≥
4.45.0** (this repo pins v4).

For D1 you have a choice, controlled by one env var:

- **Auto-provision** (default): leave `D1_DATABASE_ID` unset. Wrangler creates
  `botion-db` on deploy and links it.
- **Bind an existing DB**: set `D1_DATABASE_ID` to a real id (from
  `npx wrangler d1 list` or the dashboard). `wrangler.toml` interpolates it via
  `database_id = "${D1_DATABASE_ID}"`, so the real id never lives in git.

Copy `.dev.vars.example` → `.dev.vars` for local runs, or set the same variable
names in Workers Builds (**Settings → Build → Environment variables**).

> Never hardcode a placeholder UUID for `database_id` — a stale id breaks deploy
> with "database with id ... not found". Use the env var (or leave it unset).

**Vectorize is optional and OFF by default.** It is not auto-provisioned, and
the `[[vectorize]]` binding in `wrangler.toml` is commented out so deploys never
fail on a missing index. The app runs fine without it — semantic search falls
back to a D1 text search over page titles and block content
(`server/utils/text-search.ts`), and the code guards `env.VECTOR_INDEX` before
use. To enable semantic search:

```bash
npx wrangler vectorize create botion-vectors --dimensions=768 --metric=cosine
# then uncomment the [[vectorize]] binding in wrangler.toml and redeploy
```

For purely local development you don't need any of this — `wrangler dev --local`
creates local stand-ins automatically.

### 3. Set secrets

```bash
npx wrangler secret put JWT_SECRET   # production runtime secret
# for local dev, put JWT_SECRET in .dev.vars (see .dev.vars.example)
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

## Deployment (Cloudflare Workers Builds)

Deployment runs through **Workers Builds** (dashboard → your Worker →
**Settings → Build**), which connects to your Git repo and runs a two-step
process on every push to the production branch:

1. **Build command** — leave empty (or `pnpm install`); the Worker's TS is
   bundled by wrangler at deploy time, so no separate build is needed.
2. **Deploy command** — `npx wrangler deploy` (the default).

Because `wrangler.toml` uses **id-less bindings**, `wrangler deploy` here
**auto-provisions D1, R2, and the Queue** and links them to the Worker. This
works with the auto-generated build token — no extra permissions needed for
those three.

**Wrangler version matters.** Workers Builds uses the wrangler version from your
`package.json`. Auto-provisioning requires **wrangler ≥ 4.45.0** (this repo pins
v4). On the old v3 line, D1 is *not* auto-created and deploy fails with
"database with id ... not found".

**Vectorize is not auto-provisioned** and the **default build token cannot
create it** (that token only has KV/R2/Workers Scripts edit permissions — no
D1-create, no Vectorize). So:

- Create the index once yourself (see Setup step 2 above), **or**
- If you want the build to manage Vectorize, attach a **custom API token** to
  Workers Builds (Settings → Build → API token) that additionally includes
  **Vectorize (edit)** — but a one-time manual `vectorize create` is simpler and
  is all this project needs.

Set the `JWT_SECRET` runtime secret via **Settings → Variables & Secrets** (or
`npx wrangler secret put JWT_SECRET`).

### Client (Cloudflare Pages)

Deploy the web app separately:

```bash
pnpm build:client
pnpm deploy:client   # wrangler pages deploy client/dist --project-name=botion-web
```

### Native binaries (Tauri)

Tag a release to trigger the Tauri build workflow (`.github/workflows/release.yml`):

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
