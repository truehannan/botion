{
  "system_context": {
    "project_name": "Botion",
    "description": "An edge-native, real-time collaborative Notion clone integrated with a system-level AI agent workspace. The application is entirely serverless, running strictly on Cloudflare infrastructure.",
    "role": "You are an autonomous AI coding agent (e.g., Cursor, Windsurf, Aider). Your goal is to strictly implement the architecture, schema, and UI detailed below without deviating to alternative backend providers. Build the application systematically, chunk by chunk.",
    "branding": {
      "logo_path": "/public/logo.png",
      "logo_usage": "Always reference the static logo.png from the public/assets directory for the top-left sidebar branding and auth screens.",
      "ui_aesthetic": "Extreme minimalism inspired by Notion, Linear, and Vercel. Monochrome palette (black, white, grays). Zero visible borders on containers—rely on negative space. Use Lucide-React for 1.5px stroke icons. Font: Inter for UI, optional Serif for reading mode."
    }
  },
  "architecture": {
    "frontend": {
      "framework": "React with Vite (deployed to Cloudflare Pages)",
      "editor": "BlockNote (built on Prosemirror/Tiptap)",
      "styling": "Tailwind CSS + shadcn/ui (minimal configuration)",
      "state_management": "Zustand (local UI state) + Yjs (collaborative document state)"
    },
    "backend": {
      "framework": "Hono.js (running on Cloudflare Workers)",
      "database": "Cloudflare D1 (SQLite for workspace metadata, users, folder trees, and permissions)",
      "storage": "Cloudflare R2 (for block attachments, PDF uploads, and user avatars)",
      "real_time_sync": "Cloudflare Durable Objects with WebSocket Hibernation API + Yjs",
      "ai_layer": "Cloudflare Workers AI (LLM generation + Embeddings) + Cloudflare Vectorize (RAG index)"
    }
  },
  "execution_phases": [
    {
      "phase_1_core_infrastructure": [
        "Initialize Cloudflare monorepo structure (Pages app + Worker api).",
        "Define Cloudflare D1 schema for `Users`, `Workspaces`, `Pages`, and `Page_Permissions`.",
        "Set up Hono router in the Worker to handle REST endpoints for workspace metadata.",
        "Implement basic JWT authentication."
      ]
    },
    {
      "phase_2_realtime_collaboration": [
        "Implement the Cloudflare Durable Object class `BotionSyncRoom`.",
        "Use the WebSocket Hibernation API (`this.ctx.acceptWebSocket`) to manage connections without active compute cost.",
        "Implement Yjs binary update broadcasting inside the `webSocketMessage` handler.",
        "Implement `alarm()` in the Durable Object to batch-flush the Yjs document state to D1 every 10 seconds to minimize write operations."
      ]
    },
    {
      "phase_3_slash_editor": [
        "Integrate `<BlockNoteView>` into the React frontend.",
        "Bind the BlockNote editor instance to the Yjs WebSocket provider pointing to the Durable Object.",
        "Create a Custom Slash Menu item using BlockNote's `getCustomSlashMenuItems` hook.",
        "Add an `/Ask Agent` slash command that opens an inline AI interaction widget below the current block."
      ]
    },
    {
      "phase_4_ai_agent_mcp": [
        "Create a Cloudflare Queue task that triggers whenever a page is saved.",
        "In the Queue consumer, chunk the BlockNote JSON, pass it through Workers AI (`bge-base-en-v1.5`), and upsert to Vectorize.",
        "Implement a `/api/mcp/chat` endpoint in Hono.",
        "Provide the AI with tool calls (MCP) to: `search_vectorize_workspace`, `create_new_botion_page`, and `append_blocks_to_page`."
      ]
    }
  ],
  "critical_code_references": {
    "durable_object_hibernation_skeleton": {
      "description": "Use this structure for the real-time sync layer to ensure Cloudflare does not charge for idle WebSocket connections.",
      "code": "import { DurableObject } from 'cloudflare:workers';\nimport * as Y from 'yjs';\n\nexport class BotionSyncRoom extends DurableObject {\n  constructor(ctx, env) {\n    super(ctx, env);\n    this.doc = new Y.Doc();\n    // TODO: Load initial state from D1 if it exists\n  }\n\n  async fetch(request) {\n    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected websocket', { status: 426 });\n    \n    const [client, server] = Object.values(new WebSocketPair());\n    this.ctx.acceptWebSocket(server);\n    \n    return new Response(null, { status: 101, webSocket: client });\n  }\n\n  webSocketMessage(ws, message) {\n    // 1. Apply incoming Yjs diff to in-memory doc\n    Y.applyUpdate(this.doc, new Uint8Array(message));\n    \n    // 2. Broadcast to all other connected clients\n    for (const client of this.ctx.getWebSockets()) {\n      if (client !== ws) client.send(message);\n    }\n    \n    // 3. Set an alarm to save to D1 (batching writes to save cost)\n    this.ctx.storage.setAlarm(Date.now() + 5000);\n  }\n\n  webSocketClose(ws, code, reason, wasClean) {\n    ws.close();\n  }\n\n  async alarm() {\n    const state = Y.encodeStateAsUpdate(this.doc);\n    // TODO: Await D1 UPDATE query to persist the `state` binary blob\n  }\n}"
    },
    "blocknote_custom_slash_command": {
      "description": "Use this to inject the AI agent directly into the user's typing flow.",
      "code": "import { getDefaultReactSlashMenuItems } from '@blocknote/react';\n\nexport const getCustomSlashMenuItems = (editor) => [\n  {\n    title: 'Ask Botion Agent',\n    onItemClick: () => {\n      // Trigger Zustand state to open inline AI block at cursor\n      useUIStore.getState().setInlineAIOpen(true);\n    },\n    aliases: ['ai', 'agent', 'generate'],\n    group: 'AI Tools',\n    subtext: 'Ask the workspace agent a question or generate text.',\n  },\n  ...getDefaultReactSlashMenuItems(editor),\n];"
    }
  }
}
