import { DurableObject } from 'cloudflare:workers';
import * as Y from 'yjs';

export class BotionSyncRoom extends DurableObject {
  private doc: Y.Doc;
  private pageId: string;
  private savePending: boolean;

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    this.doc = new Y.Doc();
    this.pageId = '';
    this.savePending = false;
  }

  async initialize(pageId: string) {
    this.pageId = pageId;
    // Load persisted state from D1 if available
    const db = (this.env as any).DB;
    if (db) {
      const row = await db.prepare('SELECT state FROM document_states WHERE page_id = ?')
        .bind(pageId)
        .first<{ state: ArrayBuffer }>();
      if (row?.state) {
        Y.applyUpdate(this.doc, new Uint8Array(row.state));
      }
    }
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const pageId = url.searchParams.get('pageId');
    if (!pageId) return new Response('Missing pageId', { status: 400 });

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }

    if (!this.pageId) {
      await this.initialize(pageId);
    }

    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server as any);

    // Send current state to new client
    const state = Y.encodeStateAsUpdate(this.doc);
    (server as WebSocket).send(state);

    return new Response(null, { status: 101, webSocket: client as any });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const data = typeof message === 'string'
      ? new Uint8Array(message.split('').map(c => c.charCodeAt(0)))
      : new Uint8Array(message);

    // Apply incoming Yjs diff to in-memory doc
    Y.applyUpdate(this.doc, data);

    // Broadcast to all other connected clients
    for (const client of this.ctx.getWebSockets()) {
      if (client !== ws) client.send(data);
    }

    // Set an alarm to save to D1 (batching writes to save cost)
    this.savePending = true;
    this.ctx.storage.setAlarm(Date.now() + 5000);
  }

  webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    ws.close(code, reason);
  }

  async alarm() {
    if (!this.savePending || !this.pageId) return;
    const db = (this.env as any).DB;
    if (!db) return;

    const state = Y.encodeStateAsUpdate(this.doc);
    const now = Math.floor(Date.now() / 1000);

    await db.prepare(
      'INSERT INTO document_states (page_id, state, updated_at) VALUES (?, ?, ?) ' +
      'ON CONFLICT(page_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at'
    )
      .bind(this.pageId, state, now)
      .run();

    this.savePending = false;
  }
}
