import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';

export class YjsWebSocketProvider {
  ws: WebSocket | null = null;
  doc: Y.Doc;
  awareness: Awareness;
  private url: string;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onUpdate: () => void;

  constructor(url: string, doc: Y.Doc, onUpdate: () => void) {
    this.url = url;
    this.doc = doc;
    this.onUpdate = onUpdate;
    this.awareness = new Awareness(doc);
    this.connect();
  }

  private connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.ws = new WebSocket(this.url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.ws?.send(Y.encodeStateAsUpdate(this.doc));
    };
    this.ws.onmessage = (event) => {
      Y.applyUpdate(this.doc, new Uint8Array(event.data as ArrayBuffer));
      this.onUpdate();
    };
    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(), 2000);
    };
    this.ws.onerror = () => { this.ws?.close(); };

    this.doc.on('update', (update: Uint8Array) => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(update);
    });
  }

  destroy() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.awareness.destroy();
    this.ws?.close();
  }
}

export function createYjsProvider(pageId: string, doc: Y.Doc, onUpdate: () => void) {
  const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8787'}/pages/${pageId}/sync`;
  return new YjsWebSocketProvider(wsUrl, doc, onUpdate);
}
