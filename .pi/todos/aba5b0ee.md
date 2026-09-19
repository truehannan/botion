{
  "id": "aba5b0ee",
  "title": "Phase 4: AI Agent MCP",
  "tags": [
    "phase-4",
    "ai",
    "mcp",
    "vectorize"
  ],
  "status": "completed",
  "created_at": "2026-09-19T14:35:17.513Z"
}

- Cloudflare Queue for page save events
- Queue consumer: chunk text, Workers AI embeddings (bge-base-en-v1.5), Vectorize upsert
- /api/mcp/chat Hono endpoint
- MCP tools: search_vectorize_workspace, create_new_botion_page, append_blocks_to_page
- Page create/update triggers queue send
