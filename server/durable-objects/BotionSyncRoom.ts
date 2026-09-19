import { DurableObject } from 'cloudflare:workers';
import * as Y from 'yjs';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * BotionSyncRoom — Cloudflare Durable Object with WebSocket Hibernation.
 *
 * - Zero compute cost when idle (hibernation pauses the isolate).
 * - Yjs binary CRDT updates are applied in-memory and broadcast.
 * - An alarm batches D1 writes every 5s to minimize SQLite write ops.
 *
 * Serverless constraint: access env via the stored `env` field,
 * because DurableObject superclass does NOT expose `this.env`.
 */
export class BotionSyncRoom extends DurableObject {
  private doc: Y.Doc;
  private pageId: string;
  private savePending: boolean;
  private db: D1Database;

  constructor(ctx: DurableObjectState, env: { DB: D1Database }) {
    super(ctx, env);
    this.doc = new Y.Doc();
    this.pageId = '';
    this.savePending = false;
    this.db = env.DB;
  }

  async initialize(pageId: string) {
    this.pageId = pageId;

    // Load persisted Yjs state from D1 if available.
    const row = await this.db
      .prepare('SELECT state FROM document_states WHERE page_id = ?')
      .bind(pageId)
      .first<{ state: ArrayBuffer }>();

    if (row?.state) {
      Y.applyUpdate(this.doc, new Uint8Array(row.state));
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pageId = url.searchParams.get('pageId');
    if (!pageId) {
      return new Response('Missing pageId', { status: 400 });
    }

    const upgrade = request.headers.get('Upgrade');
    if (upgrade !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }

    if (!this.pageId) {
      await this.initialize(pageId);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.ctx.acceptWebSocket(server);

    // Send current document state to newly connecting client.
    const state = Y.encodeStateAsUpdate(this.doc);
    server.send(state);

    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const data =
      typeof message === 'string'
        ? new Uint8Array(message.split('').map((c) => c.charCodeAt(0)))
        : new Uint8Array(message);

    // 1) Apply incoming Yjs diff to in-memory CRDT.
    Y.applyUpdate(this.doc, data);

    // 2) Broadcast to all other connected clients.
    for (const client of this.ctx.getWebSockets()) {
      if (client !== ws) {
        client.send(data);
      }
    }

    // 3) Batch D1 write via alarm (5s debounce).
    this.savePending = true;
    this.ctx.storage.setAlarm(Date.now() + 5000);
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    ws.close(code, reason);
  }

  async alarm() {
    if (!this.savePending || !this.pageId) return;

    try {
      const state = Y.encodeStateAsUpdate(this.doc);
      const now = Math.floor(Date.now() / 1000);

      await this.db
        .prepare(
          'INSERT INTO document_states (page_id, state, updated_at) VALUES (?, ?, ?) ' +
            'ON CONFLICT(page_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at'
        )
        .bind(this.pageId, state, now)
        .run();

      this.savePending = false;
    } catch (err) {
      // Log and retry on next alarm cycle.
      console.error('[DO] alarm flush failed:', err);
    }
  }
}
