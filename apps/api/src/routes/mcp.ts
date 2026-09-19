import { Hono } from 'hono';
import { createDb } from '../db';
import { authMiddleware } from '../auth';
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
        workspaceId: { type: 'string', description: 'The workspace ID to search within' },
        query: { type: 'string', description: 'The search query' },
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
        parentId: { type: 'string', description: 'Optional parent page ID' },
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
        blocks: { type: 'array', description: 'Array of BlockNote block objects' },
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

      // Generate embedding via Workers AI
      const embedding = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: query });
      const vec = (embedding as any).data[0] as number[];

      const results = await env.VECTOR_INDEX.query(vec, {
        topK,
        filter: { workspaceId },
        returnMetadata: true,
      });

      return JSON.stringify({
        results: results.matches?.map((m: any) => ({
          id: m.id,
          score: m.score,
          text: m.metadata?.text,
          pageId: m.metadata?.pageId,
        })) ?? [],
      });
    }

    case 'create_new_botion_page': {
      const { workspaceId, parentId, title, isFolder } = call.arguments as any;
      const now = Math.floor(Date.now() / 1000);
      const pageId = crypto.randomUUID();

      await db.prepare(
        'INSERT INTO pages (id, workspace_id, parent_id, title, is_folder, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
        .bind(pageId, workspaceId, parentId ?? null, title, isFolder ? 1 : 0, 0, now, now)
        .run();

      return JSON.stringify({ success: true, pageId });
    }

    case 'append_blocks_to_page': {
      const { pageId, blocks } = call.arguments as any;
      const now = Math.floor(Date.now() / 1000);

      // Merge blocks into document state
      const row = await db.queryOne<{ state: ArrayBuffer }>(
        'SELECT state FROM document_states WHERE page_id = ?',
        [pageId]
      );

      const Y = await import('yjs');
      const doc = new Y.Doc();
      if (row?.state) {
        Y.applyUpdate(doc, new Uint8Array(row.state));
      }

      const pageMap = doc.getMap('page');
      const existing = pageMap.get('blocks') as any[] ?? [];
      pageMap.set('blocks', [...existing, ...blocks]);
      pageMap.set('updated_at', now);

      const state = Y.encodeStateAsUpdate(doc);
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

  // Build system prompt
  const systemPrompt = `You are the Botion AI Agent. You help users manage their workspace. ` +
    `You have access to tools to search documents, create pages, and append content. ` +
    `Current workspace: ${workspaceId}.`;

  const allMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content ?? '' })),
  ];

  // Simple tool loop (single turn for now)
  const aiResponse = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
    messages: allMessages as any,
    tools: TOOLS as any,
    stream: false,
  }) as any;

  const responseMessage = aiResponse.response ?? aiResponse;
  const toolCalls = (aiResponse.tool_calls ?? []) as MCPToolCall[];

  const results: MCPMessage[] = [];

  for (const call of toolCalls) {
    const result = await executeTool(c.env, call);
    results.push({
      role: 'tool',
      content: result,
      tool_call_id: call.name,
    });
  }

  return c.json({
    message: responseMessage,
    tool_calls: toolCalls,
    tool_results: results,
  });
});

export default app;
