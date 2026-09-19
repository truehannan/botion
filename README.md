# Botion

An edge-native, real-time collaborative Notion clone integrated with a system-level AI agent workspace. Entirely serverless on Cloudflare.

## Architecture

- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + BlockNote editor (deployed to Cloudflare Pages)
- **Backend**: Hono.js on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2
- **Real-time Sync**: Cloudflare Durable Objects with WebSocket Hibernation + Yjs
- **AI Layer**: Cloudflare Workers AI (LLM + Embeddings) + Vectorize (RAG)
- **Queue**: Cloudflare Queues for async page indexing

## Project Structure

```
botion/
├── apps/
│   ├── api/          # Hono Worker (REST + WS + DO + Queue consumer)
│   └── web/          # Vite React app (Editor + Sidebar + Auth)
├── package.json      # Root workspace config
└── pnpm-workspace.yaml
```

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/) CLI

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure Cloudflare resources

Create the following resources in your Cloudflare dashboard and update IDs in `apps/api/wrangler.toml`:

- **D1 Database** — create via `wrangler d1 create botion-db`
- **R2 Bucket** — create via `wrangler r2 bucket create botion-storage`
- **Vectorize Index** — create via `wrangler vectorize create botion-vectors --dimensions=768 --metric=cosine`
- **Queue** — create via `wrangler queues create page-save-queue`

### 3. Set secrets

```bash
cd apps/api
npx wrangler secret put JWT_SECRET
```

### 4. Run D1 migrations

```bash
pnpm db:migrate:local
```

### 5. Start development

Terminal 1 — API Worker:
```bash
pnpm dev:api
```

Terminal 2 — Web app:
```bash
pnpm dev:web
```

Open http://localhost:5173

## Deployment

### Deploy API Worker

```bash
cd apps/api
npx wrangler deploy
```

### Deploy Web (Cloudflare Pages)

```bash
cd apps/web
pnpm build
npx wrangler pages deploy dist
```

## Environment Variables

### Web (`apps/web/.env.local`)

```
VITE_API_URL=https://botion-api.your-account.workers.dev
VITE_WS_URL=wss://botion-api.your-account.workers.dev
```

## Key Features

- **Real-time Collaboration**: Yjs + Cloudflare Durable Objects with WebSocket Hibernation for zero-cost idle connections.
- **AI Slash Commands**: Type `/Ask Agent` in the BlockNote editor to open an inline AI widget.
- **MCP Agent**: Chat endpoint with tools to search your workspace, create pages, and append blocks.
- **RAG Indexing**: Pages are automatically chunked, embedded, and upserted to Vectorize on save.
