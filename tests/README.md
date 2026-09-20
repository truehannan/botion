# Botion Tests

## E2E API Test (`run.js`)

Simulates the full user journey against a local or deployed worker:

```bash
# 1. Start the local worker + D1
pnpm dev:worker:local

# 2. In another terminal, run tests
pnpm test
# or
node tests/run.js

# Test against a deployed worker:
BOTION_TEST_URL=https://your-worker.dev node tests/run.js
```

### Test Flow
1. Registers a new user
2. Creates a workspace
3. Creates pages
4. Syncs page content (client-side auto-save path)
5. Creates a database
6. Calls MCP/AI chat
7. Updates page metadata
8. Reads/writes user settings

## Manual Browser Testing

```bash
pnpm dev:local
```

Opens the client at `http://localhost:5173` connected to the local worker at `http://127.0.0.1:8787`.

In local mode:
- AI returns deterministic mocked responses
- D1, R2, DO, Queues all run via `wrangler dev --local`
- Client auto-saves to IndexedDB + syncs via REST
- No Cloudflare account required
```
