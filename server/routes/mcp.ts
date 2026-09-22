import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware } from '../auth';
import { runAI } from '../utils/ai-mock';
import { d1TextSearch } from '../utils/text-search';
import type { AppEnv } from '../types';

interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

interface MCPMessage {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: MCPToolCall[];
  tool_call_id?: string;
}

const app = new Hono<AppEnv>();
app.use('*', authMiddleware);

const TOOLS = [
  {
    name: 'search_vectorize_workspace',
    description: 'Search the workspace knowledge base using semantic similarity.',
    parameters: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        query: { type: 'string' },
        topK: { type: 'number', default: 5 },
      },
      required: ['workspaceId', 'query'],
    },
  },
  {
    name: 'create_new_botion_page',
    description: 'Create a new page or folder in Botion.',
    parameters: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        parentId: { type: 'string' },
        title: { type: 'string' },
        isFolder: { type: 'boolean', default: false },
      },
      required: ['workspaceId', 'title'],
    },
  },
  {
    name: 'append_blocks_to_page',
    description: 'Append BlockNote-compatible block content to a page.',
    parameters: {
      type: 'object',
      properties: {
        pageId: { type: 'string' },
        blocks: { type: 'array' },
      },
      required: ['pageId', 'blocks'],
    },
  },
];

async function executeTool(env: AppEnv['Bindings'], call: MCPToolCall): Promise<string> {
  const db = createDb(env.DB);

  switch (call.name) {
    case 'search_vectorize_workspace': {
      const { workspaceId, query, topK = 5 } = call.arguments as any;
      const embedding = await runAI(env.AI, '@cf/baai/bge-base-en-v1.5', { text: query });
      const vec = (embedding as any).data[0] as number[];
      try {
        const results = await env.VECTOR_INDEX.query(vec, {
          topK,
          filter: { workspaceId },
          returnMetadata: true,
        });
        const matches = results.matches?.map((m: any) => ({
          id: m.id, score: m.score, text: m.metadata?.text, pageId: m.metadata?.pageId,
        })) ?? [];
        // If Vectorize returned nothing (e.g. empty/unindexed), fall back to D1 text search.
        if (matches.length === 0) {
          const textResults = await d1TextSearch(db, workspaceId, query, topK);
          return JSON.stringify({ results: textResults, source: 'd1_text_search' });
        }
        return JSON.stringify({ results: matches, source: 'vectorize' });
      } catch {
        // Vectorize unavailable (local mode or no prod index) — D1 text search fallback.
        const textResults = await d1TextSearch(db, workspaceId, query, topK);
        return JSON.stringify({ results: textResults, source: 'd1_text_search' });
      }
    }
    case 'create_new_botion_page': {
      const { workspaceId, parentId, title, isFolder } = call.arguments as any;
      const now = Math.floor(Date.now() / 1000);
      const pageId = crypto.randomUUID();
      await db.prepare(
        'INSERT INTO pages (id, workspace_id, parent_id, title, is_folder, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(pageId, workspaceId ?? null, parentId ?? null, title ?? 'Untitled', isFolder ? 1 : 0, 0, now, now)
        .run();
      return JSON.stringify({ success: true, pageId });
    }
    case 'append_blocks_to_page': {
      const { pageId, blocks } = call.arguments as any;
      const now = Math.floor(Date.now() / 1000);
      const row = await db.queryOne<{ state: ArrayBuffer }>('SELECT state FROM document_states WHERE page_id = ?', [pageId]);
      // For simplicity in REST mode, store as JSON blob
      const doc = row?.state ? JSON.parse(new TextDecoder().decode(new Uint8Array(row.state))) : { blocks: [] };
      doc.blocks = [...(doc.blocks ?? []), ...blocks];
      doc.updated_at = now;
      const state = new TextEncoder().encode(JSON.stringify(doc));
      await db.prepare(
        'INSERT INTO document_states (page_id, state, updated_at) VALUES (?, ?, ?) ON CONFLICT(page_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at'
      )
        .bind(pageId, state, now)
        .run();
      return JSON.stringify({ success: true, appended: blocks.length });
    }
    default:
      return JSON.stringify({ error: `Unknown tool ${call.name}` });
  }
}

app.post('/chat', async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json() as { messages: MCPMessage[]; workspaceId: string };
  const { messages, workspaceId } = body;

  const systemPrompt = `You are the Botion AI Agent. You help users manage their workspace. ` +
    `You have access to tools to search documents, create pages, and append content. ` +
    `Current workspace: ${workspaceId}.`;

  const allMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content ?? '' })),
  ];

  // Use runAI for local-mode fallback
  const aiResponse = await runAI(c.env.AI, '@cf/meta/llama-3-8b-instruct', {
    messages: allMessages as any,
    tools: TOOLS as any,
    stream: false,
  }) as any;

  const responseMessage = aiResponse.response ?? aiResponse;
  const toolCalls = (aiResponse.tool_calls ?? []) as MCPToolCall[];
  const results: MCPMessage[] = [];

  for (const call of toolCalls) {
    // Inject workspace context into tool arguments if missing
    const enrichedCall = {
      ...call,
      arguments: {
        workspaceId,
        ...call.arguments,
      },
    };
    const result = await executeTool(c.env, enrichedCall);
    results.push({ role: 'tool', content: result, tool_call_id: call.name });
  }

  return c.json({ message: responseMessage, tool_calls: toolCalls, tool_results: results });
});

export default app;
